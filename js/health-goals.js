/**
 * HealthGoals Engine for HealthFood AI
 * Provides evidence-informed, non-diagnostic evaluation of foods against
 * personal health goals (Diabetic Friendly, Weight Loss, High BP, PCOS).
 */
class HealthGoalsEngine {
  constructor(storageKey = 'healthfood_profile') {
    this.storageKey = storageKey;
    this.activeGoal = 'general';
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeGoal) {
          this.activeGoal = parsed.activeGoal;
        }
      }
    } catch (err) {
      console.warn('HealthGoalsEngine: Failed to load profile', err);
    }
  }

  setGoal(goal) {
    this.activeGoal = goal;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ activeGoal: goal }));
    } catch (err) {
      console.warn('HealthGoalsEngine: Failed to save profile', err);
    }
  }

  getGoal() {
    return this.activeGoal;
  }

  /**
   * Evaluate a food item against a health goal
   * Returns non-diagnostic status, badge label, reasons array, and portion recommendation
   */
  evaluateFood(food, goal = this.activeGoal) {
    if (!food || goal === 'general') {
      return {
        goal: 'general',
        status: 'neutral',
        badgeText: 'Verified Fact',
        reasons: ['Standard nutrient breakdown per 100g.'],
        recommendation: null
      };
    }

    const macros = food.macronutrients || {};
    const calories = Number(macros.calories) || 0;
    const carbs = Number(macros.carbs_g ?? macros.carbs) || 0;
    const protein = Number(macros.protein_g ?? macros.protein) || 0;
    const fiber = Number(macros.fiber_g ?? macros.fiber) || 0;

    // Micronutrient helpers
    const micros = Array.isArray(food.micronutrients) ? food.micronutrients : [];
    const findMicroAmount = (name) => {
      const item = micros.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));
      if (!item) return 0;
      return parseFloat(item.amount) || 0;
    };

    const sodium = findMicroAmount('Sodium');
    const potassium = findMicroAmount('Potassium');

    switch (goal) {
      case 'diabetic': {
        if ((fiber >= 2 && carbs <= 25) || carbs <= 15) {
          return {
            goal: 'diabetic',
            status: 'recommended',
            badgeText: '🟢 Diabetes-friendly choice',
            reasons: ['Low net carbohydrates', 'Favorable glycemic impact'],
            recommendation: 'Great choice for stable blood sugar levels.'
          };
        } else if (carbs > 30 && fiber < 2) {
          return {
            goal: 'diabetic',
            status: 'moderate',
            badgeText: '🟡 Portion Control Recommended',
            reasons: ['Higher carbohydrate content with low fiber'],
            recommendation: 'Pair with protein or fiber to balance glycemic response.'
          };
        }
        return {
          goal: 'diabetic',
          status: 'neutral',
          badgeText: '🔵 Balanced Option',
          reasons: ['Moderate carbs and fiber ratio'],
          recommendation: 'Enjoy as part of a balanced plate.'
        };
      }


      case 'high_bp': {
        if (sodium > 350) {
          return {
            goal: 'high_bp',
            status: 'caution',
            badgeText: '🔴 High Sodium Ingredient',
            reasons: ['Contains over 350mg sodium per serving'],
            recommendation: 'Balance with low-sodium meals throughout the day.'
          };
        } else if (potassium >= 300 && sodium <= 140) {
          return {
            goal: 'high_bp',
            status: 'recommended',
            badgeText: '🟢 Heart-Healthy / Low Sodium',
            reasons: ['Rich in potassium to support blood pressure regulation', 'Low sodium content'],
            recommendation: 'Potassium helps maintain healthy fluid balance.'
          };
        }
        return {
          goal: 'high_bp',
          status: 'neutral',
          badgeText: '🟢 Low Sodium',
          reasons: ['Sodium levels within standard daily range'],
          recommendation: null
        };
      }

      case 'weight_loss': {
        if (calories <= 120 && (fiber >= 2 || protein >= 5)) {
          return {
            goal: 'weight_loss',
            status: 'recommended',
            badgeText: '🟢 High Satiety Choice',
            reasons: ['Low calorie density with high protein/fiber content'],
            recommendation: 'Helps keep you full longer with fewer total calories.'
          };
        } else if (calories > 250 && fiber < 1.5) {
          return {
            goal: 'weight_loss',
            status: 'moderate',
            badgeText: '🟡 Energy Dense',
            reasons: ['Higher calorie concentration per serving'],
            recommendation: 'Mindful portion sizing recommended.'
          };
        }
        return {
          goal: 'weight_loss',
          status: 'neutral',
          badgeText: '🔵 Balanced Option',
          reasons: ['Moderate calorie and nutrient distribution'],
          recommendation: null
        };
      }

      case 'pcos': {
        if (fiber >= 3 && protein >= 5 && carbs <= 25) {
          return {
            goal: 'pcos',
            status: 'recommended',
            badgeText: '🟢 Supports Metabolic Balance',
            reasons: ['Combination of fiber and protein supports insulin sensitivity'],
            recommendation: 'Helps maintain steady insulin levels.'
          };
        } else if (carbs > 35 && fiber < 2) {
          return {
            goal: 'pcos',
            status: 'moderate',
            badgeText: '🟡 Moderate Insulin Impact',
            reasons: ['Higher simple carbohydrates'],
            recommendation: 'Combine with healthy fats or protein to blunt glucose spikes.'
          };
        }
        return {
          goal: 'pcos',
          status: 'neutral',
          badgeText: '🔵 Balanced Choice',
          reasons: ['Provides general vitamins and minerals'],
          recommendation: null
        };
      }

      default:
        return {
          goal: 'general',
          status: 'neutral',
          badgeText: 'Verified Fact',
          reasons: [],
          recommendation: null
        };
    }
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.HealthGoalsEngine = HealthGoalsEngine;
  window.healthGoalsEngine = new HealthGoalsEngine();
}
