export class CharacterStats {
    constructor() {
        // --- PHYSICAL ATTRIBUTES ---
        this.mass = 75.0; // kg. Affects inertia and stamina drain.
        this.strength = 50.0; // 0-100. Affects carry weight (future) and speed slightly.
        this.endurance = 50.0; // 0-100. Reduces stamina drain.
        this.speedStat = 50.0; // 0-100. Base running speed skill.

        // --- VITAL SIGNS (0-100) ---
        this.health = 100.0;
        this.energy = 100.0; // Daily energy (Sleep need). 0 = Exhausted.

        // --- NEEDS (0-100) ---
        // 0 = Satisfied, 100 = Desperate
        this.hunger = 0.0;
        this.thirst = 0.0;
        this.toilet = 0.0;

        // --- STAMINA (Short term) ---
        this.maxStamina = 100.0;
        this.currentStamina = 100.0;

        // --- PROGRESSION ---
        // Experience accumulators
        this.xp = {
            strength: 0,
            endurance: 0,
            speed: 0
        };

        // --- CONFIGURATION ---
        this.config = {
            baseStaminaRegen: 5.0,
            baseStaminaDrain: 15.0,
            metabolicRate: 1.0, // Multiplier for burn
        };
    }

    update(dt, state, velocityMagnitude) {
        // dt in seconds
        const dts = dt / 1000.0;

        // --- 1. TIME DECAY (Needs & Energy) ---
        // Needs increase over time
        // Rates per second.
        // Hunger: 100 / (20 mins * 60) = ~0.08/sec (Game time might be faster?)
        // Let's assume 1 real second = 1 game minute? Or just arbitrary fast pace for testing.
        // Let's go with visible rates for now.
        const hungerRate = 0.5; // reaches 100 in 200s
        const thirstRate = 0.8; // reaches 100 in 125s
        const toiletRate = 0.3;
        const energyDrain = 0.2; // drops to 0 in 500s

        this.hunger = Math.min(100, this.hunger + hungerRate * dts);
        this.thirst = Math.min(100, this.thirst + thirstRate * dts);
        this.toilet = Math.min(100, this.toilet + toiletRate * dts);
        this.energy = Math.max(0, this.energy - energyDrain * dts);

        // --- 2. HEALTH IMPACT ---
        let healthChange = 0;

        // Critical Needs Damage
        if (this.hunger > 90) healthChange -= 2.0 * dts;
        if (this.thirst > 90) healthChange -= 5.0 * dts;
        if (this.toilet >= 100) healthChange -= 0.5 * dts; // Poisoning?

        // Regeneration (if well fed/hydrated and rested)
        if (this.hunger < 20 && this.thirst < 20 && this.energy > 50) {
            healthChange += 1.0 * dts;
        }

        this.health = Math.max(0, Math.min(100, this.health + healthChange));

        // --- 3. STAMINA & ACTIVITY ---
        // Factors
        const massFactor = this.mass / 75.0; // Heavier = harder to move
        const enduranceFactor = 1.0 + (this.endurance / 100.0); // Up to 2x efficiency
        const energyFactor = this.energy / 100.0; // Low energy = hard to run

        if (state === 'RUN') {
            // Drain
            const baseDrain = this.config.baseStaminaDrain;
            // Drain increases with Mass, decreases with Endurance
            const drain = (baseDrain * massFactor) / enduranceFactor;

            this.currentStamina = Math.max(0, this.currentStamina - drain * dts);

            // Train Stats
            this.train('endurance', dts * 0.5);
            this.train('strength', dts * 0.2 * massFactor);
            this.train('speedStat', dts * 0.3);

            // Burn Calories (Decrease Mass)
            // Simplified: Run burns fat
            this.mass -= 0.005 * dts * massFactor;

        } else if (state === 'WALK') {
            // Regenerate slowly or just hold?
            // Walking regenerates stamina but slower than Idle
            const regen = this.config.baseStaminaRegen * energyFactor * 0.5;
            this.currentStamina = Math.min(this.maxStamina, this.currentStamina + regen * dts);

            this.mass -= 0.001 * dts * massFactor;

        } else {
            // IDLE
            const regen = this.config.baseStaminaRegen * energyFactor;
            this.currentStamina = Math.min(this.maxStamina, this.currentStamina + regen * dts);

            this.mass -= 0.0002 * dts; // BMR
        }

        this.mass = Math.max(40, this.mass); // Min mass
    }

    train(stat, amount) {
        // Simple linear progression for now
        this[stat] = Math.min(100, this[stat] + amount);
    }

    // Derived Metric for Character.js
    getSpeedMultiplier() {
        // Base Speed influenced by:
        // 1. Speed Stat (Skill)
        // 2. Strength vs Mass (Power to Weight)
        // 3. Energy (Fatigue)
        // 4. Health (Injury)

        const skillFactor = 0.5 + (this.speedStat / 100.0); // 0.5x to 1.5x
        const fatigueFactor = 0.2 + (0.8 * (this.energy / 100.0)); // 0.2x at 0 energy
        const healthFactor = 0.3 + (0.7 * (this.health / 100.0)); // 0.3x at 0 health

        // Mass penalty logic: Optimal mass ~75.
        // >75 slows you down. <50 (starvation) slows you down.
        let massPenalty = 1.0;
        if (this.mass > 85) massPenalty = 85 / this.mass;
        if (this.mass < 50) massPenalty = this.mass / 50;

        return skillFactor * fatigueFactor * healthFactor * massPenalty;
    }

    canSprint() {
        return this.currentStamina > 5.0 && this.energy > 5.0;
    }
}
