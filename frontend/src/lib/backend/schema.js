// Appwrite database schema definitions for openGym.
//
// Shared constants for database, tables/collections, and column names across
// the frontend Appwrite adapter and the migration scripts.

export const DATABASE_ID = 'opengym'

export const TABLES = {
  PROFILES: 'profiles',
  WORKOUTS: 'workouts',
}

export const PROFILE_COLUMNS = {
  USER_ID: 'userId',
  TS: 'ts',
  SETTINGS: 'settings',
  ROUTINES: 'routines',
  SPLITS: 'splits',
  ACTIVE_SPLIT_ID: 'activeSplitId',
  WEEK: 'week',
  DAY_PLAN: 'dayPlan',
  EX_WEIGHTS: 'exWeights',
  CUSTOM_EX: 'customEx',
  BODYWEIGHT: 'bodyweight',
}

export const WORKOUT_COLUMNS = {
  USER_ID: 'userId',
  D: 'd',
  START: 'start',
  END: 'end',
  ROUTINE_ID: 'routineId',
  NAME: 'name',
  BW: 'bw',
  VOL: 'vol',
  PRS: 'prs',
  ENTRIES: 'entries',
}
