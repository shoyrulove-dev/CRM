export const HARAVAN_MAPPING_VERSION = 8;
type SyncCheckpoint = Record<string, unknown> | null | undefined;
export function haravanSyncState(previous: SyncCheckpoint, startedAt: string) {
  const resuming = previous?.checkpointVersion === 1 && previous?.cycleMappingVersion === HARAVAN_MAPPING_VERSION &&
    previous?.complete === false && typeof previous?.cycleStartedAt === "string" && Number.isFinite(Date.parse(previous.cycleStartedAt));
  const lastSuccess = typeof previous?.lastSuccessAt === "string" ? Date.parse(previous.lastSuccessAt) : NaN;
  const incremental = resuming ? previous?.cycleIncremental === true
    : previous?.complete === true && previous?.mappingVersion === HARAVAN_MAPPING_VERSION && Number.isFinite(lastSuccess);
  const page = (value: unknown) => Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
  return {
    incremental,
    updatedAtMin: resuming ? typeof previous?.cycleUpdatedAtMin === "string" && previous.cycleUpdatedAtMin ? previous.cycleUpdatedAtMin : undefined
      : incremental ? new Date(lastSuccess - 5 * 60_000).toISOString() : undefined,
    customerPage: resuming ? page(previous?.customerPage) : 1,
    orderPage: resuming ? page(previous?.orderPage) : 1,
    cycleStartedAt: resuming ? String(previous?.cycleStartedAt) : startedAt,
  };
}
