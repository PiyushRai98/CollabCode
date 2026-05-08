import * as Y from 'yjs';

describe('Yjs CRDT Operations', () => {
  it('should create a Y.Doc and manipulate text', () => {
    const doc = new Y.Doc();
    const text = doc.getText('monaco');
    text.insert(0, 'Hello, World!');
    expect(text.toJSON()).toBe('Hello, World!');
    doc.destroy();
  });

  it('should merge concurrent edits without conflict', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText('monaco');
    const text2 = doc2.getText('monaco');

    // User 1 types
    text1.insert(0, 'Hello');

    // Sync doc1 -> doc2
    const update1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, update1);

    // User 2 types concurrently
    text2.insert(5, ' World');

    // Sync doc2 -> doc1
    const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
    Y.applyUpdate(doc1, update2);

    // Both should converge
    expect(text1.toJSON()).toBe('Hello World');
    expect(text2.toJSON()).toBe('Hello World');

    doc1.destroy();
    doc2.destroy();
  });

  it('should handle delete operations correctly', () => {
    const doc = new Y.Doc();
    const text = doc.getText('monaco');
    text.insert(0, 'Hello, World!');
    text.delete(5, 7); // Delete ", World"
    expect(text.toJSON()).toBe('Hello!');
    doc.destroy();
  });

  it('should encode and decode state correctly', () => {
    const doc1 = new Y.Doc();
    const text1 = doc1.getText('monaco');
    text1.insert(0, 'function main() {}');

    const state = Y.encodeStateAsUpdate(doc1);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, state);
    const text2 = doc2.getText('monaco');

    expect(text2.toJSON()).toBe('function main() {}');

    doc1.destroy();
    doc2.destroy();
  });

  it('should handle three-way merge', () => {
    const server = new Y.Doc();
    const client1 = new Y.Doc();
    const client2 = new Y.Doc();

    const serverText = server.getText('monaco');
    serverText.insert(0, 'base');

    // Sync to both clients
    const initial = Y.encodeStateAsUpdate(server);
    Y.applyUpdate(client1, initial);
    Y.applyUpdate(client2, initial);

    // Client 1: insert at beginning
    client1.getText('monaco').insert(0, 'A_');

    // Client 2: insert at end
    client2.getText('monaco').insert(4, '_Z');

    // Merge client1 -> server -> client2
    const u1 = Y.encodeStateAsUpdate(client1, Y.encodeStateVector(server));
    Y.applyUpdate(server, u1);

    const u2 = Y.encodeStateAsUpdate(client2, Y.encodeStateVector(server));
    Y.applyUpdate(server, u2);

    // Sync back
    const final1 = Y.encodeStateAsUpdate(server, Y.encodeStateVector(client1));
    Y.applyUpdate(client1, final1);

    const final2 = Y.encodeStateAsUpdate(server, Y.encodeStateVector(client2));
    Y.applyUpdate(client2, final2);

    // All three should converge
    const result = serverText.toJSON();
    expect(client1.getText('monaco').toJSON()).toBe(result);
    expect(client2.getText('monaco').toJSON()).toBe(result);
    expect(result).toContain('A_');
    expect(result).toContain('base');
    expect(result).toContain('_Z');

    server.destroy();
    client1.destroy();
    client2.destroy();
  });
});
