export class Item {
    constructor(id, name, type, weight, icon) {
        this.id = id;
        this.name = name;
        this.type = type; // 'tool', 'resource', 'food'
        this.weight = weight;
        this.icon = icon; // Emoji or image URL
        this.stats = null; // { nutrition: 10, hydration: 5 }
    }
}

export class Inventory {
    constructor(characterStats) {
        this.stats = characterStats;
        this.slots = new Array(20).fill(null); // 20 slots
        this.hands = { left: null, right: null };
        this.isOpen = false;

        // Initial Item
        this.addItem(new Item('axe_stone', 'Kamienna Siekiera', 'tool', 2.5, '🪓'));

        this.initUI();
    }

    get currentWeight() {
        let w = 0;
        this.slots.forEach(i => { if(i) w += i.weight; });
        if(this.hands.left) w += this.hands.left.weight;
        if(this.hands.right) w += this.hands.right.weight;
        return w;
    }

    get maxWeight() {
        // Strength 1-100. Max carry 10kg + Strength * 0.5 (Max 60kg)
        return 10.0 + (this.stats.strength * 0.5);
    }

    addItem(item) {
        if (this.currentWeight + item.weight > this.maxWeight) return false;

        // Find first empty slot
        const idx = this.slots.findIndex(s => s === null);
        if (idx !== -1) {
            this.slots[idx] = item;
            this.render();
            return true;
        }
        return false;
    }

    removeItem(item) {
        const idx = this.slots.indexOf(item);
        if (idx !== -1) {
            this.slots[idx] = null;
            this.render();
            return true;
        }
        if (this.hands.left === item) {
            this.hands.left = null;
            this.render();
            return true;
        }
        if (this.hands.right === item) {
            this.hands.right = null;
            this.render();
            return true;
        }
        return false;
    }

    consumeItem(item) {
        if (!item) return;

        if (item.type === 'food' && item.stats) {
            if (item.stats.nutrition) this.stats.eat(item.stats.nutrition);
            if (item.stats.hydration) this.stats.drink(item.stats.hydration);

            // Remove 1 unit. For now items are unique instances, so just remove.
            this.removeItem(item);
            console.log(`Consumed ${item.name}`);
        } else {
            console.log("Cannot consume this.");
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('inventory-panel');
        if (this.isOpen) panel.classList.add('open');
        else panel.classList.remove('open');
        this.render();
    }

    initUI() {
        // Hook up toggle button
        const btn = document.getElementById('btn-inventory');
        if (btn) btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Hook up close button
        const btnClose = document.getElementById('btn-inventory-close');
        if (btnClose) btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Setup Drag Events on container
        const container = document.getElementById('inventory-container');
        if (!container) return;
    }

    render() {
        const slotsContainer = document.getElementById('inv-slots');
        const handsContainer = document.getElementById('inv-hands');
        const weightLabel = document.getElementById('inv-weight');

        if (!slotsContainer || !handsContainer) return;

        // Update Weight
        if (weightLabel) {
            weightLabel.innerText = `${this.currentWeight.toFixed(1)} / ${this.maxWeight.toFixed(1)} kg`;
            weightLabel.style.color = this.currentWeight > this.maxWeight ? 'red' : 'white';
        }

        // Render Slots
        slotsContainer.innerHTML = '';
        this.slots.forEach((item, index) => {
            const slot = this.createSlotElement(item, 'slot', index);
            slotsContainer.appendChild(slot);
        });

        // Render Hands
        handsContainer.innerHTML = '';
        const leftSlot = this.createSlotElement(this.hands.left, 'hand', 'left');
        leftSlot.classList.add('hand-slot');
        leftSlot.dataset.hand = 'Left';
        handsContainer.appendChild(leftSlot);

        const rightSlot = this.createSlotElement(this.hands.right, 'hand', 'right');
        rightSlot.classList.add('hand-slot');
        rightSlot.dataset.hand = 'Right';
        handsContainer.appendChild(rightSlot);
    }

    createSlotElement(item, type, index) {
        const div = document.createElement('div');
        div.className = 'inv-slot';
        div.dataset.type = type;
        div.dataset.index = index;

        if (item) {
            div.innerText = item.icon;
            div.title = `${item.name} (${item.weight}kg)`;
            div.draggable = true;
            div.classList.add('filled');

            // Drag Start
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type, index }));
                e.dataTransfer.effectAllowed = 'move';
            });

            // Interaction: Double Click to Consume
            div.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.consumeItem(item);
            });

            // Interaction: Long Press (Simulated via simple timeout or separate handler)
            // Since this is DOM, we can just use dblclick for now which is standard for desktop.
            // For touch, dblclick might be hard. Let's add a simple click listener that checks modifiers?
            // Or rely on the context menu logic if we want to add that later.
            // "Actions" are requested.
        }

        // Drop Zone
        div.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            e.dataTransfer.dropEffect = 'move';
            div.classList.add('drag-over');
        });

        div.addEventListener('dragleave', () => {
            div.classList.remove('drag-over');
        });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            this.handleMove(data.type, data.index, type, index);
        });

        return div;
    }

    handleMove(fromType, fromIndex, toType, toIndex) {
        // Get Source Item
        let item = null;
        if (fromType === 'slot') item = this.slots[fromIndex];
        else if (fromType === 'hand') item = this.hands[fromIndex]; // index is 'left' or 'right'

        if (!item) return;

        // Remove from source
        if (fromType === 'slot') this.slots[fromIndex] = null;
        else this.hands[fromIndex] = null;

        // Check Target
        let targetItem = null;
        if (toType === 'slot') {
            targetItem = this.slots[toIndex];
            this.slots[toIndex] = item;
        } else if (toType === 'hand') {
            targetItem = this.hands[toIndex];
            this.hands[toIndex] = item;
        }

        // Swap (put target item back to source)
        if (targetItem) {
            if (fromType === 'slot') this.slots[fromIndex] = targetItem;
            else this.hands[fromIndex] = targetItem;
        }

        this.render();
    }
}
