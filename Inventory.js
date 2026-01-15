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

        // Setup Drag Events on container (Delegation)
        const container = document.getElementById('inventory-panel');
        if (!container) return;

        container.addEventListener('dragstart', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (!slot || !slot.classList.contains('filled')) return;

            const type = slot.dataset.type;
            const index = slot.dataset.index;

            e.dataTransfer.setData('text/plain', JSON.stringify({ type, index }));
            e.dataTransfer.effectAllowed = 'move';
        });

        container.addEventListener('dragover', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                e.preventDefault(); // Allow drop
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                slot.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (slot) {
                e.preventDefault();
                slot.classList.remove('drag-over');

                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data && data.type && data.index !== undefined) {
                        this.handleMove(data.type, data.index, slot.dataset.type, slot.dataset.index);
                    }
                } catch (err) {
                    console.error('Invalid drop data', err);
                }
            }
        });

        container.addEventListener('dblclick', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (!slot || !slot.classList.contains('filled')) return;

            e.stopPropagation();
            const type = slot.dataset.type;
            const index = slot.dataset.index;

            let item = null;
            if (type === 'slot') item = this.slots[index];
            else if (type === 'hand') item = this.hands[index];

            this.consumeItem(item);
        });

        // Touch Support (Long Press to Drag)
        let dragSource = null;
        let dragGhost = null;
        let longPressTimer = null;
        let isDragging = false;
        let startTouch = null;

        container.addEventListener('touchstart', (e) => {
            const slot = e.target.closest('.inv-slot');
            if (!slot || !slot.classList.contains('filled')) return;

            // Only primary touch
            if (e.touches.length > 1) return;

            startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };

            // Start Long Press Timer
            longPressTimer = setTimeout(() => {
                isDragging = true;

                // Create Ghost
                dragSource = {
                    type: slot.dataset.type,
                    index: slot.dataset.index
                };

                dragGhost = slot.cloneNode(true);
                dragGhost.style.position = 'fixed';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.zIndex = '1000';
                dragGhost.style.opacity = '0.8';
                dragGhost.style.width = `${slot.offsetWidth}px`;
                dragGhost.style.height = `${slot.offsetHeight}px`;
                dragGhost.style.left = `${startTouch.x - slot.offsetWidth/2}px`;
                dragGhost.style.top = `${startTouch.y - slot.offsetHeight/2}px`;

                document.body.appendChild(dragGhost);

                // Add vibration feedback if available
                if (navigator.vibrate) navigator.vibrate(50);

            }, 300); // 300ms Long Press
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) return;
            const touch = e.touches[0];

            if (isDragging) {
                e.preventDefault(); // Prevent scrolling
                if (dragGhost) {
                    dragGhost.style.left = `${touch.clientX - dragGhost.offsetWidth/2}px`;
                    dragGhost.style.top = `${touch.clientY - dragGhost.offsetHeight/2}px`;
                }

                // Highlight drop target
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const slot = target ? target.closest('.inv-slot') : null;

                // Clean up previous hover
                container.querySelectorAll('.inv-slot.drag-over').forEach(el => el.classList.remove('drag-over'));

                if (slot) {
                    slot.classList.add('drag-over');
                }
            } else {
                // Check if moved enough to cancel long press
                if (startTouch) {
                    const dx = touch.clientX - startTouch.x;
                    const dy = touch.clientY - startTouch.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist > 10) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                        startTouch = null;
                    }
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
            startTouch = null;

            if (isDragging) {
                isDragging = false;
                e.preventDefault(); // Prevent click simulation

                if (dragGhost) {
                    dragGhost.remove();
                    dragGhost = null;
                }

                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const slot = target ? target.closest('.inv-slot') : null;

                if (slot) {
                    slot.classList.remove('drag-over');
                    try {
                        // Use dataset values
                        this.handleMove(
                            dragSource.type,
                            dragSource.index,
                            slot.dataset.type,
                            slot.dataset.index
                        );
                    } catch (err) {
                        console.error('Touch Drop Error', err);
                    }
                }

                // Cleanup visual state
                container.querySelectorAll('.inv-slot.drag-over').forEach(el => el.classList.remove('drag-over'));
                dragSource = null;
            }
        });
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
        }

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
