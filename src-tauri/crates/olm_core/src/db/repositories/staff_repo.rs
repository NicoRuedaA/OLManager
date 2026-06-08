use crate::domain::staff::{Staff, StaffAttributes, StaffRole};
use rusqlite::{Connection, params};

/// Insert or replace a staff row.
pub fn upsert_staff(conn: &Connection, s: &Staff) -> Result<(), String> {
    let attrs_json =
        serde_json::to_string(&s.attributes).map_err(|e| format!("JSON error: {}", e))?;
    let role_str = format!("{:?}", s.role);

    conn.execute(
        "INSERT OR REPLACE INTO staff
          (id, first_name, last_name, date_of_birth, nationality, birth_country, profile_image_url, role,
           attributes, team_id, wage, contract_end)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            s.id,
            s.first_name,
            s.last_name,
            s.date_of_birth,
            s.nationality,
            s.birth_country,
            s.profile_image_url,
            role_str,
            attrs_json,
            s.team_id,
            s.wage,
            s.contract_end,
        ],
    )
    .map_err(|e| format!("Failed to upsert staff: {}", e))?;
    Ok(())
}

/// Insert or replace multiple staff members.
pub fn upsert_staff_list(conn: &Connection, staff: &[Staff]) -> Result<(), String> {
    for s in staff {
        upsert_staff(conn, s)?;
    }
    Ok(())
}

fn parse_role(s: &str) -> StaffRole {
    match s {
        "AssistantManager" => StaffRole::AssistantManager,
        "Coach" => StaffRole::Coach,
        "Scout" => StaffRole::Scout,
        "Physio" => StaffRole::Physio,
        "Owner" => StaffRole::Owner,
        _ => StaffRole::Coach,
    }
}

/// Load all staff.
pub fn load_all_staff(conn: &Connection) -> Result<Vec<Staff>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, first_name, last_name, date_of_birth, nationality, birth_country, profile_image_url, role,
                    attributes, team_id, wage, contract_end
             FROM staff",
        )
        .map_err(|e| format!("Failed to prepare staff query: {}", e))?;

    let rows = stmt
        .query_map([], row_to_staff)
        .map_err(|e| format!("Failed to query staff: {}", e))?;

    let mut staff = Vec::new();
    for row in rows {
        staff.push(row.map_err(|e| format!("Failed to read staff row: {}", e))?);
    }
    Ok(staff)
}

fn row_to_staff(row: &rusqlite::Row) -> rusqlite::Result<Staff> {
    let role_str: String = row.get(7)?;
    let attrs_json: String = row.get(8)?;

    Ok(Staff {
        id: row.get(0)?,
        first_name: row.get(1)?,
        last_name: row.get(2)?,
        date_of_birth: row.get(3)?,
        nationality: row.get(4)?,
        birth_country: row.get(5)?,
        profile_image_url: row.get(6)?,
        role: parse_role(&role_str),
        attributes: serde_json::from_str(&attrs_json).unwrap_or(StaffAttributes {
            coaching: 50,
            judging_ability: 50,
            judging_potential: 50,
            physiotherapy: 50,
        }),
        team_id: row.get(9)?,
        wage: row.get(10)?,
        contract_end: row.get(11)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    fn sample_staff(id: &str, role: StaffRole) -> Staff {
        let mut s = Staff::new(
            id.to_string(),
            "Alice".to_string(),
            "Coach".to_string(),
            "1980-05-10".to_string(),
            role,
            StaffAttributes {
                coaching: 75,
                judging_ability: 60,
                judging_potential: 55,
                physiotherapy: 40,
            },
        );
        s.nationality = "GB".to_string();
        s.team_id = Some("team-001".to_string());
        s.wage = 3000;
        s
    }

    #[test]
    fn test_upsert_and_load_staff() {
        let db = test_db();
        let mut staff = sample_staff("staff-001", StaffRole::Coach);
        staff.nationality = "Scottish".to_string();
        staff.birth_country = Some("SCO".to_string());

        upsert_staff(db.conn(), &staff).unwrap();
        let all = load_all_staff(db.conn()).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, "staff-001");
        assert_eq!(all[0].role, StaffRole::Coach);
        assert_eq!(all[0].attributes.coaching, 75);
        assert_eq!(all[0].wage, 3000);
        assert_eq!(all[0].birth_country, Some("SCO".to_string()));
    }

    #[test]
    fn test_upsert_staff_list() {
        let db = test_db();
        let list = vec![
            sample_staff("s-001", StaffRole::Coach),
            sample_staff("s-002", StaffRole::Scout),
            sample_staff("s-003", StaffRole::Physio),
            sample_staff("s-004", StaffRole::AssistantManager),
        ];

        upsert_staff_list(db.conn(), &list).unwrap();
        let all = load_all_staff(db.conn()).unwrap();
        assert_eq!(all.len(), 4);
    }

    #[test]
    fn test_staff_roundtrip_different_roles() {
        let db = test_db();
        let coach = sample_staff("s-001", StaffRole::Coach);
        let physio = sample_staff("s-002", StaffRole::Physio);

        upsert_staff(db.conn(), &coach).unwrap();
        upsert_staff(db.conn(), &physio).unwrap();
        let all = load_all_staff(db.conn()).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].role, StaffRole::Coach);
        assert_eq!(all[1].role, StaffRole::Physio);
    }
}

