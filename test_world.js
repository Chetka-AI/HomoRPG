import './test_setup.js'; // Import the mock setup first
import { World, GameObject } from './Objects.js';
import assert from 'assert';

// Mock GameObject since the base class throws an error on render
class MockGameObject extends GameObject {
    constructor(x,y,type) {
        super(x,y,type);
    }
    render() {} // Prevent render error
}

function testWorldRemove() {
    console.log('Running test: testWorldRemove...');
    const world = new World();
    const obj1 = new MockGameObject(1, 1, 'mock');
    const obj2 = new MockGameObject(2, 2, 'mock');
    const obj3 = new MockGameObject(3, 3, 'mock');

    world.add(obj1);
    world.add(obj2);
    world.add(obj3);

    assert.strictEqual(world.objects.length, 3, 'Initial length should be 3');

    world.remove(obj2);

    assert.strictEqual(world.objects.length, 2, 'Length after remove should be 2');
    assert.strictEqual(world.objects.indexOf(obj2), -1, 'Removed object should not be in the array');
    assert.ok(world.objects.includes(obj1), 'obj1 should still be in the array');
    assert.ok(world.objects.includes(obj3), 'obj3 should still be in the array');

    console.log('testWorldRemove PASSED.');
}

// Run all tests
try {
    testWorldRemove();
    console.log('All tests passed!');
} catch (error) {
    console.error('Tests FAILED:', error.message);
    process.exit(1); // Exit with error code
}
