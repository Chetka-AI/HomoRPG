// Mock a minimal DOM environment for Node.js
if (typeof global.document === 'undefined') {
    global.document = {
        getElementById: (id) => {
            console.log(`Mock document.getElementById called for: ${id}`);
            return {
                addEventListener: () => {},
                classList: {
                    add: () => {},
                    remove: () => {}
                },
                style: {}
            };
        },
        createElement: (type) => {
            console.log(`Mock document.createElement called for: ${type}`);
            if (type === 'canvas') {
                return {
                    getContext: () => ({
                        drawImage: () => {},
                        fillRect: () => {},
                        beginPath: () => {},
                        moveTo: () => {},
                        lineTo: () => {},
                        closePath: () => {},
                        fill: () => {},
                        stroke: () => {},
                        arc: () => {},
                        rect: () => {},
                    }),
                    width: 0,
                    height: 0,
                };
            }
            return {
                style: {},
                dataset: {},
                appendChild: () => {}
            };
        },
        body: {
            appendChild: () => {}
        },
        elementFromPoint: () => null,
    };
}

if (typeof global.Image === 'undefined') {
    global.Image = class MockImage {
        constructor() {
            // Simulate async loading behavior
            setTimeout(() => {
                this.onload && this.onload();
            }, 10);
        }
    };
}

if (typeof global.navigator === 'undefined') {
    global.navigator = {
        vibrate: () => {}
    };
}
