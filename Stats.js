export class CharacterStats {
    constructor() {
        // Vital Parameters
        this.mass = 75.0; // kg
        this.strength = 1.0; // Multiplier

        // Stamina
        // "500 kafli" logic:
        // Assuming 1 tile = 100px. 500 tiles = 50,000px.
        // Speed ~ 2.5px/frame * 60fps = 150px/sec.
        // 50,000 / 150 = 333 seconds.
        // That is very long for "short" stamina.
        // Let's set a default max that feels playable but scales towards that goal.
        // Let's go with 100 units = 10 seconds default sprint for now, expandable.
        this.maxStamina = 100.0;
        this.currentStamina = 100.0;

        // Training/Progression
        this.staminaXp = 0.0;

        // Configuration
        this.baseStaminaRegen = 5.0; // per second
        this.baseStaminaDrain = 10.0; // per second
    }

    update(dt, state, velocityMagnitude) {
        // dt is in ms, convert to seconds
        const dts = dt / 1000.0;

        // 1. Stamina Logic
        if (state === 'RUN') {
            // Drain Rate Calculation
            // Increases with Body Mass (fatigue from weight)
            // Decreases with Stamina XP (training)

            const massFactor = this.mass / 75.0; // Normalized to default weight
            const trainingFactor = 1.0 + (this.staminaXp * 0.05); // +5% efficiency per XP level (simplified)

            const drainRate = this.baseStaminaDrain * massFactor / trainingFactor;

            this.currentStamina -= drainRate * dts;
            if (this.currentStamina < 0) this.currentStamina = 0;

            // Training: Gain XP while running
            this.staminaXp += dts * 0.01; // Slow gain

            // Strength: Small gain from running (carrying body weight)
            this.strength += dts * 0.001 * massFactor;

        } else {
            // Regenerate
            this.currentStamina += this.baseStaminaRegen * dts;
            if (this.currentStamina > this.maxStamina) this.currentStamina = this.maxStamina;
        }

        // 2. Metabolism / Mass (Placeholder)
        // Activity burns calories.
        // Walk = low burn, Run = high burn.
        const burnRate = (state === 'RUN' ? 0.002 : (state === 'WALK' ? 0.0005 : 0.0001));

        // Mass decreases very slowly if not eating (simplified thermodynamics)
        this.mass -= burnRate * dts;
        if (this.mass < 40) this.mass = 40; // Hard min limit
    }

    // Future use
    eat(calories) {
        // Simplified: 7000kcal ~ 1kg fat
        this.mass += calories / 7000.0;
    }

    canSprint() {
        return this.currentStamina > 1.0;
    }
}
