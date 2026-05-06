#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrimResultQuality {
    Good,
    Bad,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DailyScrimFlowState {
    NoScrimsToday,
    SelectDayScrims,
    Block1Result,
    Block1GoodDecision,
    Block1BadDecision,
    Block1BadCancelDecision,
    Block2Result,
    Block2GoodDecision,
    Block2BadDecision,
    DayClosed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DailyScrimFlowEvent {
    SelectDayScrims,
    ResolveBlock1(ScrimResultQuality),
    ResolveBlock2(ScrimResultQuality),
    OfferRest,
    ContinueToBlock2,
    PushThrough,
    CancelScrims,
    VodReview,
    MentalReset,
    TargetedDrills,
    DayOff,
}

pub fn transition_daily_scrim_flow(
    state: DailyScrimFlowState,
    event: DailyScrimFlowEvent,
) -> Result<DailyScrimFlowState, String> {
    use DailyScrimFlowEvent as E;
    use DailyScrimFlowState as S;
    use ScrimResultQuality as Q;

    let next = match (state, event) {
        (S::NoScrimsToday, E::SelectDayScrims) => S::SelectDayScrims,
        (S::SelectDayScrims, E::ResolveBlock1(Q::Good)) => S::Block1GoodDecision,
        (S::SelectDayScrims, E::ResolveBlock1(Q::Bad)) => S::Block1BadDecision,

        (S::Block1GoodDecision, E::OfferRest) => S::DayClosed,
        (S::Block1GoodDecision, E::ContinueToBlock2) => S::Block2Result,

        (S::Block1BadDecision, E::PushThrough) => S::Block2Result,
        (S::Block1BadDecision, E::CancelScrims) => S::Block1BadCancelDecision,

        (S::Block1BadCancelDecision, E::VodReview) => S::DayClosed,
        (S::Block1BadCancelDecision, E::MentalReset) => S::DayClosed,
        (S::Block1BadCancelDecision, E::TargetedDrills) => S::DayClosed,

        (S::Block2Result, E::ResolveBlock2(Q::Good)) => S::Block2GoodDecision,
        (S::Block2Result, E::ResolveBlock2(Q::Bad)) => S::Block2BadDecision,

        (S::Block2GoodDecision, E::DayOff) => S::DayClosed,

        (S::Block2BadDecision, E::DayOff) => S::DayClosed,
        (S::Block2BadDecision, E::VodReview) => S::DayClosed,
        (S::Block2BadDecision, E::MentalReset) => S::DayClosed,
        (S::Block2BadDecision, E::TargetedDrills) => S::DayClosed,

        _ => {
            return Err(format!(
                "Invalid scrim flow transition: state={state:?}, event={event:?}"
            ));
        }
    };

    Ok(next)
}
