import type { PerformanceReview } from "./performanceReviews";

export type PerformanceReviewBoardStage =
  | "Not Started"
  | "Manager Review"
  | "Submitted"
  | "Calibration Review"
  | "Finalized";

export const PERFORMANCE_REVIEW_BOARD_STAGES: PerformanceReviewBoardStage[] = [
  "Not Started",
  "Manager Review",
  "Submitted",
  "Calibration Review",
  "Finalized",
];

export function resolvePerformanceReviewBoardStage(
  review: PerformanceReview,
  calibrationRequired: boolean,
): PerformanceReviewBoardStage {
  if (review.status === "Completed" || review.workflowState === "Finalized") {
    return "Finalized";
  }
  if (review.status === "Pending") return "Not Started";
  if (
    review.workflowState === "Calibration In Review" ||
    review.calibrationStatus === "In Review"
  ) {
    return "Calibration Review";
  }
  if (
    calibrationRequired &&
    (review.workflowState === "Calibration Pending" ||
      (!!review.managerSubmittedAt && review.calibrationStatus === "Pending"))
  ) {
    return "Submitted";
  }
  return "Manager Review";
}

export function performanceReviewBoardStageDescription(
  stage: PerformanceReviewBoardStage,
): string {
  switch (stage) {
    case "Not Started":
      return "Assigned reviews waiting for the evaluator to begin.";
    case "Manager Review":
      return "Draft or revision work owned by the assigned evaluator.";
    case "Submitted":
      return "Manager review submitted and waiting for required calibration.";
    case "Calibration Review":
      return "Admin/HR is actively validating the submitted review.";
    case "Finalized":
      return "Governed final results; reopen requires a reason and audit history.";
  }
}
