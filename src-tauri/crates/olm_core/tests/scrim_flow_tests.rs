use ofm_core::scrim_flow::{
    DailyScrimFlowEvent as E, DailyScrimFlowState as S, ScrimResultQuality as Q,
    transition_daily_scrim_flow,
};

#[test]
fn follows_good_block1_path_to_block2_and_close() {
    let s1 = transition_daily_scrim_flow(S::NoScrimsToday, E::SelectDayScrims).unwrap();
    let s2 = transition_daily_scrim_flow(s1, E::ResolveBlock1(Q::Good)).unwrap();
    let s3 = transition_daily_scrim_flow(s2, E::ContinueToBlock2).unwrap();
    let s4 = transition_daily_scrim_flow(s3, E::ResolveBlock2(Q::Good)).unwrap();
    let s5 = transition_daily_scrim_flow(s4, E::DayOff).unwrap();

    assert_eq!(s5, S::DayClosed);
}

#[test]
fn follows_bad_block1_pushthrough_then_bad_block2_path() {
    let s1 = transition_daily_scrim_flow(S::NoScrimsToday, E::SelectDayScrims).unwrap();
    let s2 = transition_daily_scrim_flow(s1, E::ResolveBlock1(Q::Bad)).unwrap();
    let s3 = transition_daily_scrim_flow(s2, E::PushThrough).unwrap();
    let s4 = transition_daily_scrim_flow(s3, E::ResolveBlock2(Q::Bad)).unwrap();
    let s5 = transition_daily_scrim_flow(s4, E::MentalReset).unwrap();

    assert_eq!(s5, S::DayClosed);
}

#[test]
fn rejects_skipping_block1_decision() {
    let s1 = transition_daily_scrim_flow(S::NoScrimsToday, E::SelectDayScrims).unwrap();
    let s2 = transition_daily_scrim_flow(s1, E::ResolveBlock1(Q::Bad)).unwrap();

    let invalid = transition_daily_scrim_flow(s2, E::ResolveBlock2(Q::Good));
    assert!(invalid.is_err());
}

#[test]
fn rejects_showing_both_blocks_at_once() {
    let s1 = transition_daily_scrim_flow(S::NoScrimsToday, E::SelectDayScrims).unwrap();
    let s2 = transition_daily_scrim_flow(s1, E::ResolveBlock1(Q::Good)).unwrap();

    let invalid = transition_daily_scrim_flow(s2, E::DayOff);
    assert!(invalid.is_err());
}
