/** Non-authoritative diagnostic publication cannot alter its parent operation. */
export async function publishInspectionBestEffort(
  publish: () => Promise<unknown>,
  onFailure: (error: unknown) => void,
  onReporterFailure: (error: unknown) => void,
): Promise<void> {
  try {
    await publish();
  } catch (error) {
    try {
      onFailure(error);
    } catch (reportingError) {
      try {
        onReporterFailure(reportingError);
      } catch {
        // Diagnostic reporting must not escape this boundary.
      }
    }
  }
}
