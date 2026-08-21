/**
 * Authoritative D1 Food Matcher and Nutrition Calculator for Cloudflare Worker Backend
 * Implements the central Golden Rule: AI identifies -> D1 verifies -> calculator computes -> frontend renders.
 */

export interface D1MatchedFood {
  foodId: number;
  slug: string;
  displayName: string;
  baseServingGrams: number;
  macronutrients: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

export async function matchFoodInD1(detectedName: string, db: any): Promise<D1MatchedFood | null> {
  if (!detectedName || !db) return null;

  const normalized = detectedName.trim().toLowerCase();

  try {
    // 1. Direct query against foods and nutrition tables
    const query = `
      SELECT 
        f.id, 
        f.slug, 
        f.name, 
        f.canonical_name, 
        f.serving_size_g,
        n.calories, 
        n.protein_g, 
        n.carbs_g, 
        n.fat_g, 
        n.fiber_g
      FROM foods f
      LEFT JOIN nutrition n ON f.id = n.food_id
      WHERE LOWER(f.name) = ? OR LOWER(f.slug) = ? OR LOWER(f.canonical_name) = ?
         OR LOWER(f.name) LIKE ? OR LOWER(f.slug) LIKE ?
      LIMIT 1
    `;

    const row: any = await db.prepare(query)
      .bind(normalized, normalized, normalized, `%${normalized}%`, `%${normalized}%`)
      .first();

    if (row && row.id) {
      return {
        foodId: row.id,
        slug: row.slug,
        displayName: row.name,
        baseServingGrams: row.serving_size_g || 100,
        macronutrients: {
          calories: Number(row.calories) || 0,
          protein_g: Number(row.protein_g) || 0,
          carbs_g: Number(row.carbs_g) || 0,
          fat_g: Number(row.fat_g) || 0,
          fiber_g: Number(row.fiber_g) || 0
        }
      };
    }

    // 2. Query food aliases if alias table exists
    const aliasQuery = `
      SELECT food_id FROM food_aliases WHERE LOWER(alias_name) = ? OR LOWER(alias_name) LIKE ? LIMIT 1
    `;
    const aliasRow: any = await db.prepare(aliasQuery).bind(normalized, `%${normalized}%`).first();

    if (aliasRow && aliasRow.food_id) {
      const matchedRow: any = await db.prepare(`
        SELECT f.id, f.slug, f.name, f.serving_size_g, n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g
        FROM foods f LEFT JOIN nutrition n ON f.id = n.food_id WHERE f.id = ? LIMIT 1
      `).bind(aliasRow.food_id).first();

      if (matchedRow) {
        return {
          foodId: matchedRow.id,
          slug: matchedRow.slug,
          displayName: matchedRow.name,
          baseServingGrams: matchedRow.serving_size_g || 100,
          macronutrients: {
            calories: Number(matchedRow.calories) || 0,
            protein_g: Number(matchedRow.protein_g) || 0,
            carbs_g: Number(matchedRow.carbs_g) || 0,
            fat_g: Number(matchedRow.fat_g) || 0,
            fiber_g: Number(matchedRow.fiber_g) || 0
          }
        };
      }
    }
  } catch (err) {
    console.warn('[D1 Food Matcher] Query failed:', err);
  }

  return null;
}

/**
 * Calculate scaled nutrition from D1 verified facts based on estimated grams
 * Formula: scaled_nutrient = (100g_nutrient * selected_grams) / 100
 */
export function calculateScaledNutritionFromD1(macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number }, estimatedGrams: number) {
  const safeGrams = Math.max(0, Math.min(2000, Number(estimatedGrams) || 100));
  const factor = safeGrams / 100;

  return {
    calories: Math.round((macros.calories || 0) * factor),
    protein: Number(((macros.protein_g || 0) * factor).toFixed(1)),
    carbs: Number(((macros.carbs_g || 0) * factor).toFixed(1)),
    fat: Number(((macros.fat_g || 0) * factor).toFixed(1)),
    fiber: Number(((macros.fiber_g || 0) * factor).toFixed(1))
  };
}
