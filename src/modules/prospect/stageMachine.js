
export const STAGES = {
  NEW                : "NEW",
  ENGAGED            : "ENGAGED",
  STRATEGY_SCHEDULED : "STRATEGY_SCHEDULED",
  STRATEGY_COMPLETED : "STRATEGY_COMPLETED",
  TOKEN_DISCUSSION   : "TOKEN_DISCUSSION",
  TOKEN_RECEIVED     : "TOKEN_RECEIVED",
  WIN                : "WIN",
  ARCHIVED           : "ARCHIVED",
}

// Maps current stage → allowed next stages
export const ALLOWED_TRANSITIONS = {
  [STAGES.NEW]                : [STAGES.ENGAGED,            STAGES.ARCHIVED],
  [STAGES.ENGAGED]            : [STAGES.STRATEGY_SCHEDULED, STAGES.ARCHIVED],
  [STAGES.STRATEGY_SCHEDULED] : [STAGES.STRATEGY_COMPLETED, STAGES.ARCHIVED],
  [STAGES.STRATEGY_COMPLETED] : [STAGES.TOKEN_DISCUSSION,   STAGES.ARCHIVED],
  [STAGES.TOKEN_DISCUSSION]   : [STAGES.TOKEN_RECEIVED,     STAGES.ARCHIVED],
  [STAGES.TOKEN_RECEIVED]     : [STAGES.WIN,                STAGES.ARCHIVED],
  [STAGES.WIN]                : [],
  [STAGES.ARCHIVED]           : [],  // needs manager_approval_id to move back
}

export const isValidStage = (stage) => {
  return Object.values(STAGES).includes(stage)
}

export const canTransition = (from, to) => {
  const allowed = ALLOWED_TRANSITIONS[from] || []
  return allowed.includes(to)
}