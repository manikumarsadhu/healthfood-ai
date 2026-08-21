/**
 * Structured AI Output JSON Schemas & Types
 */

export interface IngredientCheckResult {
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  redFlags: Array<{
    ingredient: string;
    severity: "high" | "moderate" | "low";
    reason: string;
  }>;
  positiveIngredients: string[];
  recommendation: string;
  confidence: number;
}

export interface VisionDetectionItem {
  detectedName: string;
  estimatedGrams: number;
  confidence: number;
}

export interface VisionDetectionResult {
  foods: VisionDetectionItem[];
  notes?: string;
}

export interface CravingSwapItem {
  name: string;
  reason: string;
  estimatedCaloriesSavePercent: number;
}

export interface CravingSwapResult {
  craving: string;
  swaps: CravingSwapItem[];
}
