// Mock de window.__TAURI_INTERNALS__ para Playwright
// Copia del world.json simplificada para tests
(function () {
  const worldData = {
    teams: [
      { id: "lec-fnatic", name: "Fnatic", short_name: "FNC", country: "GB", city: "London", logo_url: "/teams-icons/fnatic.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 500, finance: 3500000, wage_budget: 770000, transfer_budget: 1225000 },
      { id: "lec-g2-esports", name: "G2 Esports", short_name: "G2", country: "DE", city: "Berlin", logo_url: "/teams-icons/g2-esports.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 650, finance: 4500000, wage_budget: 990000, transfer_budget: 1575000 },
      { id: "lec-giantx-lec", name: "GIANTX", short_name: "GX", country: "ES", city: "M\u00e1laga", logo_url: "/teams-icons/giantx-lec.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 500, finance: 3500000, wage_budget: 770000, transfer_budget: 1225000 },
      { id: "lec-karmine-corp", name: "Karmine Corp", short_name: "KC", country: "FR", city: "Paris", logo_url: "/teams-icons/karmine-corp.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 650, finance: 4500000, wage_budget: 990000, transfer_budget: 1575000 },
      { id: "lec-movistar-koi", name: "Movistar KOI", short_name: "MKOI", country: "ES", city: "Madrid", logo_url: "/teams-icons/movistar-koi.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 650, finance: 4500000, wage_budget: 990000, transfer_budget: 1575000 },
      { id: "lec-natus-vincere", name: "Natus Vincere", short_name: "NAVI", country: "UA", city: "Kyiv", logo_url: "/teams-icons/natus-vincere.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 500, finance: 3500000, wage_budget: 770000, transfer_budget: 1225000 },
      { id: "lec-shifters", name: "Shifters", short_name: "shft", country: "TR", city: "Istanbul", logo_url: "/teams-icons/shifters.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 320, finance: 3000000, wage_budget: 660000, transfer_budget: 1050000 },
      { id: "lec-sk-gaming", name: "SK Gaming", short_name: "SK", country: "DE", city: "Berlin", logo_url: "/teams-icons/sk-gaming.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 320, finance: 3000000, wage_budget: 660000, transfer_budget: 1050000 },
      { id: "lec-team-heretics-lec", name: "Team Heretics", short_name: "TH", country: "ES", city: "Madrid", logo_url: "/teams-icons/team-heretics-lec.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 500, finance: 3500000, wage_budget: 770000, transfer_budget: 1225000 },
      { id: "lec-team-vitality", name: "Team Vitality", short_name: "VIT", country: "FR", city: "Paris", logo_url: "/teams-icons/team-vitality.webp", colors: { primary: "#1f2937", secondary: "#f3f4f6" }, reputation: 650, finance: 4500000, wage_budget: 990000, transfer_budget: 1575000 },
    ],
    players: [],
  };

  // Generar 5 players por equipo con stats variadas
  const roles = ["Top", "Jungle", "Mid", "Adc", "Support"];
  const nombres = [
    ["Bwipo", "Razork", "Humanoid", "Noah", "Jun"],
    ["BrokenBlade", "Yike", "Caps", "Hans Sama", "Labrov"],
    ["Th3Antonio", "Xerxe", "Jackies", "Patrik", "Mersa"],
    ["Canna", "Yike", "Vladi", "Caliste", "Targamas"],
    ["Myrwn", "Elyoya", "Fresskowy", "Supa", "Alvaro"],
    ["Szygenda", "Lyncas", "Nisqy", "Ice", "Hylissang"],
    ["Shlatan", "??", "??", "??", "??"],
    ["Irrelevant", "Isma", "RKR", "Jackspektra", "Bertho"],
    ["Carlsen", "Sheo", "Perkz", "Flakked", "Kaiser"],
    ["Naak Nako", "Lyncas", "Czajek", "Carzzy", "Hylissang"],
  ];

  for (let ti = 0; ti < worldData.teams.length; ti++) {
    for (let ri = 0; ri < roles.length; ri++) {
      const seed = ti * 100 + ri;
      worldData.players.push({
        id: "player-" + seed,
        match_name: nombres[ti]?.[ri] ?? ("Player " + seed),
        full_name: nombres[ti]?.[ri] ?? ("Player " + seed),
        date_of_birth: "2000-01-01",
        nationality: "EUN",
        birth_country: null,
        position: roles[ri],
        natural_position: roles[ri],
        alternate_positions: [],
        attributes: {
          mechanics: 50 + (seed % 40),
          laning: 50 + ((seed * 3) % 40),
          teamfighting: 50 + ((seed * 7) % 40),
          macro_play: 50 + ((seed * 5) % 40),
          consistency: 50 + ((seed * 11) % 40),
          shotcalling: 50 + ((seed * 13) % 40),
          champion_pool: 50 + ((seed * 17) % 40),
          discipline: 50 + ((seed * 19) % 40),
          mental_resilience: 50 + ((seed * 23) % 40),
        },
        condition: 100,
        morale: 100,
        fitness: 75,
        injury: null,
        team_id: worldData.teams[ti].id,
        traits: [],
        contract_end: null,
        wage: 25000,
        market_value: 1200000,
        stats: { assists: 0, avg_rating: 0 },
        career: [],
        training_focus: null,
        transfer_listed: false,
        loan_listed: false,
        transfer_offers: [],
        morale_core: { manager_trust: 50, unresolved_issue: null, recent_treatment: null, pending_promise: null, talk_cooldown_until: null, renewal_state: null },
      });
    }
  }

  const mockManager = {
    id: "mgr_user",
    nickname: "JD",
    first_name: "John",
    last_name: "Doe",
    date_of_birth: "2000-01-15",
    nationality: "ES",
    avatar_path: null,
    reputation: 500,
    satisfaction: 50,
    fan_approval: 50,
    team_id: null,
    career_stats: { total_matches: 0, total_wins: 0, total_losses: 0, total_draws: 0, win_rate: 0, titles: 0, best_finish: null, total_transfers: 0, total_spent: 0, total_received: 0, current_streak: 0, longest_win_streak: 0, seasons_completed: 0 },
    career_history: [],
  };

  function buildGameState(teamId) {
    const selectedTeam = worldData.teams.find(function (t) { return t.id === teamId; });
    return {
      clock: { current_date: "2025-01-01", start_date: "2025-01-01" },
      manager: Object.assign({}, mockManager, { team_id: teamId }),
      teams: worldData.teams,
      players: worldData.players,
      staff: [],
      messages: [],
      news: [],
      league: {
        id: "lec-2025",
        name: "LEC 2025",
        standings: worldData.teams.map(function (t, i) {
          return { team_id: t.id, wins: Math.floor(Math.random() * 10), losses: Math.floor(Math.random() * 10), points: 0, position: i + 1, form: [] };
        }),
        season: 1,
        current_week: 1,
        total_weeks: 18,
        fixtures: [],
      },
      scouting_assignments: [],
      board_objectives: [],
      champions: [],
    };
  }

  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd, args) {
      switch (cmd) {
        case "start_new_game":
          return Promise.resolve("ok");
        case "get_team_selection_data":
          return Promise.resolve({
            manager: Object.assign({}, mockManager, { team_id: null }),
            teams: worldData.teams,
            players: worldData.players,
          });
        case "select_team":
          return Promise.resolve(buildGameState(args.teamId));
        default:
          console.warn("[Tauri mock] Unhandled invoke:", cmd, args);
          return Promise.reject(new Error("Mock not implemented: " + cmd));
      }
    },
  };
})();
