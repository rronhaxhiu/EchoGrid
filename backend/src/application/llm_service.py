"""
Groq LLM integration for natural-language event generation.

Takes a plain-English scenario description plus run context and returns
a validated AddEventRequest-compatible dictionary.
"""

import asyncio
import json
import logging
import math
from typing import Any, Dict, List, Optional

from groq import AsyncGroq, APIConnectionError, RateLimitError, APIStatusError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hex coordinate helper — generate all valid (q, r) in the grid
# ---------------------------------------------------------------------------

def _hex_coords_in_radius(radius: int) -> List[List[int]]:
    """Return all axial coordinates within the given hex radius."""
    coords: List[List[int]] = []
    for q in range(-radius, radius + 1):
        r_min = max(-radius, -q - radius)
        r_max = min(radius, -q + radius)
        for r in range(r_min, r_max + 1):
            coords.append([q, r])
    return coords


# ---------------------------------------------------------------------------
# System prompt template
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are an event generator for a hexagonal grid world simulation.

The simulation tracks variables on a 2D hex grid using axial (q, r) coordinates.
Users describe scenarios in plain English and you translate them into a single \
structured JSON event.

### Output format (strict — no markdown, no explanation, ONLY raw JSON):

{{
  "tick": <int>,
  "name": "<snake_case_event_name>",
  "delta_map": {{ "<variable>": <float_delta>, ... }},
  "target_tiles": [[q1, r1], [q2, r2], ...]
}}

### Rules:
1. `tick` MUST be an integer strictly greater than {current_tick}.
2. `name` must be a short, descriptive snake_case identifier (e.g. "flood_disaster").
3. `delta_map` keys MUST come from the available variables: {variables}.
   - Positive delta = increase, negative delta = decrease.
   - Choose realistic magnitudes (typically ±5 to ±50).
4. `target_tiles` MUST only contain coordinates that exist in the grid.
   The grid has hex_radius={hex_radius}. Valid coordinates: {sample_coords}
   - For "center" scenarios, use [0,0] and its neighbors.
   - For "widespread" scenarios, include many tiles.
   - For "edge" scenarios, use tiles near the boundary.
5. Respond with ONLY the JSON object. No markdown fences, no commentary.\
"""


class GroqEventGenerator:
    """
    Translates natural-language scenario descriptions into valid
    simulation events using Groq's LLM API.
    """

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile") -> None:
        self._client = AsyncGroq(api_key=api_key)
        self._model = model

    async def generate_event(
        self,
        prompt: str,
        *,
        variables: List[str],
        hex_radius: int,
        current_tick: int,
        global_state: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Call Groq LLM to generate a simulation event from a natural-language prompt.

        Returns a dict with keys:
            event   — parsed AddEventRequest-compatible dict
            llm_raw — the raw LLM output string
        """
        all_coords = _hex_coords_in_radius(hex_radius)
        # Show a manageable sample of coords in the prompt
        if len(all_coords) > 30:
            sample = all_coords[:15] + [["..."]] + all_coords[-5:]
        else:
            sample = all_coords

        state_summary = ", ".join(
            f"{var}={val:.1f}" for var, val in global_state.items()
        )

        system_msg = _SYSTEM_PROMPT.format(
            current_tick=current_tick,
            variables=variables,
            hex_radius=hex_radius,
            sample_coords=json.dumps(sample),
        )

        user_msg = (
            f"Current global averages: {state_summary}\n\n"
            f"Scenario: {prompt}"
        )

        last_error: Optional[str] = None

        for attempt in range(3):
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    temperature=0.4,
                    max_tokens=1024,
                )

                raw = response.choices[0].message.content.strip()
                logger.info("Groq response (attempt %d): %s", attempt + 1, raw[:200])

                # Strip markdown fences if the model wraps them anyway
                cleaned = raw
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("```", 1)[0]
                cleaned = cleaned.strip()

                parsed = json.loads(cleaned)

                # --- Validate & sanitize ---
                event = self._validate(parsed, variables, hex_radius, current_tick)

                return {"event": event, "llm_raw": raw}

            except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
                last_error = f"Attempt {attempt + 1}: {exc}"
                logger.warning("LLM parse error: %s", last_error)
                await asyncio.sleep(1)
                continue
            except (APIConnectionError, RateLimitError, APIStatusError) as exc:
                last_error = f"Attempt {attempt + 1}: Groq API error: {exc}"
                logger.warning("Groq API error: %s", last_error)
                await asyncio.sleep(2 * (attempt + 1))  # backoff
                continue

        raise ValueError(
            f"Failed to generate a valid event after 3 attempts. Last error: {last_error}"
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate(
        parsed: Dict[str, Any],
        variables: List[str],
        hex_radius: int,
        current_tick: int,
    ) -> Dict[str, Any]:
        """Sanitize and validate the LLM-generated event dict."""

        # --- tick ---
        tick = int(parsed["tick"])
        if tick <= current_tick:
            tick = current_tick + 1

        # --- name ---
        name = str(parsed["name"]).strip().replace(" ", "_").lower()
        if not name:
            name = "generated_event"

        # --- delta_map ---
        raw_delta = parsed.get("delta_map", {})
        if not isinstance(raw_delta, dict):
            raise ValueError("delta_map must be a dict")
        delta_map: Dict[str, float] = {}
        for var, val in raw_delta.items():
            if var in variables:
                delta_map[var] = float(val)
        if not delta_map:
            raise ValueError(
                f"delta_map contains no valid variables. "
                f"Got {list(raw_delta.keys())}, expected from {variables}"
            )

        # --- target_tiles ---
        raw_tiles = parsed.get("target_tiles", [])
        if not isinstance(raw_tiles, list) or not raw_tiles:
            raise ValueError("target_tiles must be a non-empty list")

        valid_set = set()
        for q in range(-hex_radius, hex_radius + 1):
            r_min = max(-hex_radius, -q - hex_radius)
            r_max = min(hex_radius, -q + hex_radius)
            for r in range(r_min, r_max + 1):
                valid_set.add((q, r))

        target_tiles: List[List[int]] = []
        for tile in raw_tiles:
            if isinstance(tile, (list, tuple)) and len(tile) == 2:
                q, r = int(tile[0]), int(tile[1])
                if (q, r) in valid_set:
                    target_tiles.append([q, r])

        if not target_tiles:
            # Fallback to center tile
            target_tiles = [[0, 0]]

        return {
            "tick": tick,
            "name": name,
            "delta_map": delta_map,
            "target_tiles": target_tiles,
            "source": "AI",
        }


# ---------------------------------------------------------------------------
# Run Interpretation
# ---------------------------------------------------------------------------

_INTERPRET_SYSTEM_PROMPT = """\
You are a world analyst for a hexagonal grid simulation.

The simulation tracks variables on a 2D hex grid. You must analyze the current \
world state and provide a structured JSON assessment.

### Output format (strict — ONLY raw JSON, no markdown, no commentary):

{{
  "narrative": "<2-3 sentence summary of the world state>",
  "anomalies": [
    {{
      "variable": "<variable_name>",
      "description": "<what is anomalous and why it matters>",
      "severity": "<low|medium|high>",
      "affected_tiles": [[q1, r1], [q2, r2], ...]
    }}
  ],
  "suggestions": [
    {{
      "name": "<snake_case_event_name>",
      "description": "<why this corrective action is needed>",
      "delta_map": {{ "<variable>": <float_delta>, ... }},
      "target_tiles": [[q1, r1], ...]
    }}
  ]
}}

### Rules:
1. `narrative` must be 2-3 concise sentences describing the overall world health.
2. `anomalies`: flag variables/tiles that are extreme outliers or concerning.
   - `severity`: "low" (<1 std dev concern), "medium" (1-2 std dev), "high" (>2 std dev or critical).
   - Only include genuine anomalies (0-{max_anomalies} items). Empty array if none.
3. `suggestions`: propose corrective events to address problems.{suggestions_instruction}
   - `delta_map` keys MUST be from: {variables}.
   - `target_tiles` MUST be valid coords for hex_radius={hex_radius}.
   - Only include if there are real problems to fix (0-{max_suggestions} items).
4. Respond with ONLY the JSON object.\
"""

_COMPARISON_CONTEXT = """
=== CHANGE ANALYSIS (tick {from_tick} -> {to_tick}) ===
Previous global averages: {prev_state}
Current global averages: {curr_state}
Deltas: {delta_state}
Tiles with largest changes: {changed_tiles}
"""


class GroqRunInterpreter:
    """
    Analyzes the current simulation state and produces a structured
    narrative, anomaly flags, and corrective event suggestions.
    """

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile") -> None:
        self._client = AsyncGroq(api_key=api_key)
        self._model = model

    async def interpret(
        self,
        *,
        variables: List[str],
        hex_radius: int,
        current_tick: int,
        global_state: Dict[str, float],
        tile_snapshot: Dict[str, Dict[str, float]],
        recent_events: List[Dict[str, Any]],
        influence_config: Dict[str, Dict[str, float]],
        include_suggestions: bool = True,
        max_anomalies: int = 5,
        max_suggestions: int = 3,
        # Comparison mode
        compare_from_tick: Optional[int] = None,
        compare_global_state: Optional[Dict[str, float]] = None,
        compare_tile_snapshot: Optional[Dict[str, Dict[str, float]]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze the world state and return narrative + anomalies + suggestions.
        """
        # --- Build outlier summary (tiles deviating >1 std dev) ---
        outlier_summary = self._compute_outliers(tile_snapshot, global_state, variables)

        # --- Build state summary ---
        state_str = ", ".join(f"{v}={val:.1f}" for v, val in global_state.items())

        # --- Build event history summary ---
        event_summary = "None"
        if recent_events:
            parts = []
            for e in recent_events[-5:]:
                parts.append(f"tick {e.get('tick')}: {e.get('name')} ({e.get('source', 'user')})")
            event_summary = "; ".join(parts)

        # --- Build influence summary ---
        influence_str = "None configured"
        if influence_config:
            parts = []
            for v1, targets in influence_config.items():
                for v2, coeff in targets.items():
                    if coeff != 0:
                        parts.append(f"{v1}->{v2}: {coeff:+.2f}")
            if parts:
                influence_str = ", ".join(parts)

        # --- Suggestions instruction ---
        suggestions_instruction = ""
        if not include_suggestions:
            suggestions_instruction = "\n   - Return an empty array for suggestions."

        system_msg = _INTERPRET_SYSTEM_PROMPT.format(
            variables=variables,
            hex_radius=hex_radius,
            max_anomalies=max_anomalies,
            max_suggestions=max_suggestions,
            suggestions_instruction=suggestions_instruction,
        )

        user_msg = (
            f"Simulation tick: {current_tick}\n"
            f"Global averages: {state_str}\n"
            f"Outlier tiles (>1 std dev from mean): {json.dumps(outlier_summary)}\n"
            f"Recent events: {event_summary}\n"
            f"Influence matrix: {influence_str}\n"
        )

        # --- Comparison mode ---
        if compare_from_tick is not None and compare_global_state is not None:
            prev_str = ", ".join(f"{v}={val:.1f}" for v, val in compare_global_state.items())
            delta_str = ", ".join(
                f"{v}={global_state.get(v, 0) - compare_global_state.get(v, 0):+.1f}"
                for v in variables
            )
            # Find tiles with biggest changes
            changed = self._compute_tile_changes(
                tile_snapshot, compare_tile_snapshot or {}, variables
            )

            user_msg += _COMPARISON_CONTEXT.format(
                from_tick=compare_from_tick,
                to_tick=current_tick,
                prev_state=prev_str,
                curr_state=state_str,
                delta_state=delta_str,
                changed_tiles=json.dumps(changed[:10]),
            )

        last_error: Optional[str] = None

        for attempt in range(3):
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    temperature=0.5,
                    max_tokens=2048,
                )

                raw = response.choices[0].message.content.strip()
                logger.info("Interpret response (attempt %d): %s", attempt + 1, raw[:300])

                cleaned = raw
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("```", 1)[0]
                cleaned = cleaned.strip()

                parsed = json.loads(cleaned)

                result = self._validate(
                    parsed, variables, hex_radius, current_tick,
                    max_anomalies, max_suggestions, include_suggestions,
                )
                result["llm_raw"] = raw
                return result

            except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
                last_error = f"Attempt {attempt + 1}: {exc}"
                logger.warning("Interpret parse error: %s", last_error)
                await asyncio.sleep(1)
                continue
            except (APIConnectionError, RateLimitError, APIStatusError) as exc:
                last_error = f"Attempt {attempt + 1}: Groq API error: {exc}"
                logger.warning("Groq API error: %s", last_error)
                await asyncio.sleep(2 * (attempt + 1))
                continue

        raise ValueError(
            f"Failed to interpret run after 3 attempts. Last error: {last_error}"
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_outliers(
        tile_snapshot: Dict[str, Dict[str, float]],
        global_state: Dict[str, float],
        variables: List[str],
    ) -> List[Dict[str, Any]]:
        """Find tiles that deviate >1 std dev from the mean for any variable."""
        if not tile_snapshot:
            return []

        n = len(tile_snapshot)
        if n < 2:
            return []

        # Compute std dev per variable
        std_devs: Dict[str, float] = {}
        for var in variables:
            mean = global_state.get(var, 0)
            variance = sum(
                (tile_vars.get(var, 0) - mean) ** 2
                for tile_vars in tile_snapshot.values()
            ) / n
            std_devs[var] = variance ** 0.5

        outliers = []
        for tile_key, tile_vars in tile_snapshot.items():
            for var in variables:
                val = tile_vars.get(var, 0)
                mean = global_state.get(var, 0)
                sd = std_devs.get(var, 0)
                if sd > 0 and abs(val - mean) > sd:
                    outliers.append({
                        "tile": tile_key,
                        "variable": var,
                        "value": round(val, 1),
                        "mean": round(mean, 1),
                        "deviation": round((val - mean) / sd, 1),
                    })

        # Sort by absolute deviation, keep top 20
        outliers.sort(key=lambda x: abs(x["deviation"]), reverse=True)
        return outliers[:20]

    @staticmethod
    def _compute_tile_changes(
        current: Dict[str, Dict[str, float]],
        previous: Dict[str, Dict[str, float]],
        variables: List[str],
    ) -> List[Dict[str, Any]]:
        """Find tiles with the largest total change between two snapshots."""
        changes = []
        for tile_key, curr_vars in current.items():
            prev_vars = previous.get(tile_key, {})
            total_change = 0.0
            deltas = {}
            for var in variables:
                d = curr_vars.get(var, 0) - prev_vars.get(var, 0)
                if d != 0:
                    deltas[var] = round(d, 1)
                    total_change += abs(d)
            if total_change > 0:
                changes.append({
                    "tile": tile_key,
                    "deltas": deltas,
                    "total_change": round(total_change, 1),
                })
        changes.sort(key=lambda x: x["total_change"], reverse=True)
        return changes

    @staticmethod
    def _validate(
        parsed: Dict[str, Any],
        variables: List[str],
        hex_radius: int,
        current_tick: int,
        max_anomalies: int,
        max_suggestions: int,
        include_suggestions: bool,
    ) -> Dict[str, Any]:
        """Validate and sanitize the LLM interpretation response."""

        # --- narrative ---
        narrative = str(parsed.get("narrative", "No narrative provided.")).strip()
        if not narrative:
            narrative = "No narrative provided."

        # --- anomalies ---
        raw_anomalies = parsed.get("anomalies", [])
        if not isinstance(raw_anomalies, list):
            raw_anomalies = []
        anomalies = []
        valid_set = set()
        for q in range(-hex_radius, hex_radius + 1):
            r_min = max(-hex_radius, -q - hex_radius)
            r_max = min(hex_radius, -q + hex_radius)
            for r in range(r_min, r_max + 1):
                valid_set.add((q, r))

        for a in raw_anomalies[:max_anomalies]:
            if not isinstance(a, dict):
                continue
            var = str(a.get("variable", ""))
            if var not in variables:
                continue
            severity = str(a.get("severity", "medium")).lower()
            if severity not in ("low", "medium", "high"):
                severity = "medium"
            tiles = []
            for t in a.get("affected_tiles", []):
                if isinstance(t, (list, tuple)) and len(t) == 2:
                    q, r = int(t[0]), int(t[1])
                    if (q, r) in valid_set:
                        tiles.append([q, r])
            anomalies.append({
                "variable": var,
                "description": str(a.get("description", "")),
                "severity": severity,
                "affected_tiles": tiles,
            })

        # --- suggestions ---
        suggestions = []
        if include_suggestions:
            raw_suggestions = parsed.get("suggestions", [])
            if not isinstance(raw_suggestions, list):
                raw_suggestions = []
            for s in raw_suggestions[:max_suggestions]:
                if not isinstance(s, dict):
                    continue
                name = str(s.get("name", "corrective_event")).strip().replace(" ", "_").lower()
                raw_dm = s.get("delta_map", {})
                if not isinstance(raw_dm, dict):
                    continue
                dm = {k: float(v) for k, v in raw_dm.items() if k in variables}
                if not dm:
                    continue
                tiles = []
                for t in s.get("target_tiles", [[0, 0]]):
                    if isinstance(t, (list, tuple)) and len(t) == 2:
                        q, r = int(t[0]), int(t[1])
                        if (q, r) in valid_set:
                            tiles.append([q, r])
                if not tiles:
                    tiles = [[0, 0]]

                suggestions.append({
                    "name": name,
                    "description": str(s.get("description", "")),
                    "delta_map": dm,
                    "target_tiles": tiles,
                    "tick": current_tick + 1,
                })

        return {
            "narrative": narrative,
            "anomalies": anomalies,
            "suggestions": suggestions,
        }

