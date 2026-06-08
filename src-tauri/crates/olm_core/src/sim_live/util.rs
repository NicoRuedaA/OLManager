use serde_json::{Map, Value};

use super::types::Vec2;

pub fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

pub fn as_mut_object(value: &mut Value) -> Result<&mut Map<String, Value>, String> {
    value
        .as_object_mut()
        .ok_or_else(|| "runtime state must be a JSON object".to_string())
}

pub fn read_winner(state: &Value) -> Option<String> {
    state
        .get("winner")
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

pub fn read_time_sec(state: &Value) -> f64 {
    state.get("timeSec").and_then(Value::as_f64).unwrap_or(0.0)
}

pub fn ratio_or_zero(value: f64, max: f64) -> f64 {
    if max <= 0.0 {
        0.0
    } else {
        clamp(value / max, 0.0, 1.0)
    }
}

pub fn dist(a: Vec2, b: Vec2) -> f64 {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    (dx * dx + dy * dy).sqrt()
}

pub fn normalize(v: Vec2) -> Vec2 {
    let len = (v.x * v.x + v.y * v.y).sqrt();
    if len <= 1e-9 {
        Vec2 { x: 0.0, y: 0.0 }
    } else {
        Vec2 {
            x: v.x / len,
            y: v.y / len,
        }
    }
}
