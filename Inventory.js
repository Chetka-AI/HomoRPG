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

        // Setup Drag & Drop
        this.setupDragDrop();
    }

    setupDragDrop() {
        const panel = document.getElementById('inventory-panel');
        if (!panel) return;

        let dragItem = null;
        let ghost = null;
        let startX = 0, startY = 0;
        let isDragging = false;

        const onPointerDown = (e) => {
            const slot = e.target.closest('.inv-slot');
            if (!slot || !slot.classList.contains('filled')) return;

            // Don't prevent default immediately to allow click/dblclick interactions
            // and native touch behavior if we don't move enough.

            startX = e.clientX;
            startY = e.clientY;

            const type = slot.dataset.type;
            const rawIndex = slot.dataset.index;
            const index = (type === 'hand') ? rawIndex : parseInt(rawIndex, 10);

            dragItem = { slot, type, index };
            isDragging = false;

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        };

        const onPointerMove = (e) => {
            if (!dragItem) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (!isDragging && dist > 5) {
                isDragging = true;

                // Create ghost
                ghost = dragItem.slot.cloneNode(true);
                ghost.style.position = 'absolute';
                ghost.style.width = `${dragItem.slot.offsetWidth}px`;
                ghost.style.height = `${dragItem.slot.offsetHeight}px`;
                ghost.style.opacity = '0.8';
                ghost.style.zIndex = '1000';
                ghost.style.pointerEvents = 'none';
                ghost.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
                ghost.style.transform = 'scale(1.1)';

                // Initial position
                updateGhostPosition(e.clientX, e.clientY);

                document.body.appendChild(ghost);
            }

            if (isDragging && ghost) {
                updateGhostPosition(e.clientX, e.clientY);
            }
        };

        const updateGhostPosition = (cx, cy) => {
            if (!ghost) return;
            ghost.style.left = `${cx - ghost.offsetWidth / 2}px`;
            ghost.style.top = `${cy - ghost.offsetHeight / 2}px`;
        };

        const onPointerUp = (e) => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);

            if (isDragging && ghost) {
                ghost.remove();
                ghost = null;

                // Find Drop Target
                const target = document.elementFromPoint(e.clientX, e.clientY);
                const targetSlot = target ? target.closest('.inv-slot') : null;

                if (targetSlot) {
                    const toType = targetSlot.dataset.type;
                    const toRawIndex = targetSlot.dataset.index;
                    const toIndex = (toType === 'hand') ? toRawIndex : parseInt(toRawIndex, 10);

                    // Prevent swapping with self
                    if (dragItem.type !== toType || dragItem.index !== toIndex) {
                        this.handleMove(dragItem.type, dragItem.index, toType, toIndex);
                    }
                }
            }

            dragItem = null;
            isDragging = false;
        };

        // Touch Support (Long Press to Drag)
        let dragSource = null;
        let dragGhost = null;
        let longPressTimer = null;
        let startTouch = null;

        const container = panel; // Using panel as container

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
            div.classList.add('filled');

            // Interaction: Double Click to Consume
            div.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.consumeItem(item);
            });
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
