// ============================================================
//  FIREBASE CONFIGURATION & AUTO-MOCK FALLBACK
//  Replace the values below with your own Firebase project config.
//  If left as "YOUR_API_KEY", it will automatically fall back to
//  a fully functional LocalStorage-based Mock database!
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

let db;

if (isFirebaseConfigured) {
  // Initialize Real Firebase
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  // Enable offline persistence
  db.enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence.');
    }
  });
} else {
  console.log("⚠️ Firebase not configured. Falling back to LocalStorage database mock!");
  
  // Create a robust client-side Firestore Mock
  class MockDocRef {
    constructor(collectionName, id) {
      this.collectionName = collectionName;
      this.id = id;
    }
    async get() {
      const data = MockDatabase.getDoc(this.collectionName, this.id);
      return {
        exists: !!data,
        id: this.id,
        data: () => data
      };
    }
    async update(newData) {
      MockDatabase.updateDoc(this.collectionName, this.id, newData);
      return this;
    }
    async set(newData) {
      MockDatabase.setDoc(this.collectionName, this.id, newData);
      return this;
    }
  }

  class MockQuery {
    constructor(collectionName, modifiers = []) {
      this.collectionName = collectionName;
      this.modifiers = modifiers;
    }
    orderBy(field, direction = 'asc') {
      return new MockQuery(this.collectionName, [...this.modifiers, { type: 'orderBy', field, direction }]);
    }
    async get() {
      let docs = MockDatabase.getCollection(this.collectionName);
      // apply orderBy
      this.modifiers.forEach(mod => {
        if (mod.type === 'orderBy') {
          docs.sort((a, b) => {
            const valA = a[mod.field] ?? '';
            const valB = b[mod.field] ?? '';
            if (valA < valB) return mod.direction === 'asc' ? -1 : 1;
            if (valA > valB) return mod.direction === 'asc' ? 1 : -1;
            return 0;
          });
        }
      });
      return {
        empty: docs.length === 0,
        forEach: (callback) => {
          docs.forEach(doc => {
            callback({
              id: doc.id,
              data: () => {
                const { id, ...rest } = doc;
                return rest;
              }
            });
          });
        }
      };
    }
    onSnapshot(callback) {
      // Trigger immediately
      this.get().then(snap => callback(snap));
      // Register listener
      return MockDatabase.subscribe(this.collectionName, () => {
        this.get().then(snap => callback(snap));
      });
    }
  }

  class MockCollectionRef extends MockQuery {
    doc(id) {
      const docId = id || Math.random().toString(36).substring(2, 15);
      return new MockDocRef(this.collectionName, docId);
    }
    async add(data) {
      const id = Math.random().toString(36).substring(2, 15);
      MockDatabase.setDoc(this.collectionName, id, data);
      return new MockDocRef(this.collectionName, id);
    }
  }

  const MockDatabase = {
    listeners: {},
    getCollection(name) {
      const data = localStorage.getItem(`mock_db_${name}`);
      return data ? JSON.parse(data) : [];
    },
    saveCollection(name, list) {
      localStorage.setItem(`mock_db_${name}`, JSON.stringify(list));
      if (this.listeners[name]) {
        this.listeners[name].forEach(cb => cb());
      }
    },
    getDoc(colName, id) {
      const list = this.getCollection(colName);
      return list.find(d => d.id === id) || null;
    },
    setDoc(colName, id, data) {
      const list = this.getCollection(colName);
      const idx = list.findIndex(d => d.id === id);
      const parsedData = this.resolveFields(data);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...parsedData, id };
      } else {
        list.push({ ...parsedData, id });
      }
      this.saveCollection(colName, list);
    },
    updateDoc(colName, id, data) {
      const list = this.getCollection(colName);
      const idx = list.findIndex(d => d.id === id);
      if (idx !== -1) {
        const current = list[idx];
        const parsedData = this.resolveFields(data, current);
        list[idx] = { ...current, ...parsedData, id };
        this.saveCollection(colName, list);
      }
    },
    subscribe(colName, callback) {
      if (!this.listeners[colName]) this.listeners[colName] = [];
      this.listeners[colName].push(callback);
      return () => {
        this.listeners[colName] = this.listeners[colName].filter(cb => cb !== callback);
      };
    },
    resolveFields(data, current = {}) {
      const resolved = { ...data };
      for (let key in resolved) {
        const val = resolved[key];
        if (val && val._mockIncrement !== undefined) {
          const base = current[key] || 0;
          resolved[key] = base + val._mockIncrement;
        } else if (val === '__MOCK_SERVER_TIMESTAMP__') {
          resolved[key] = new Date().toISOString();
        }
      }
      return resolved;
    }
  };

  // Mock global firebase namespaces
  window.firebase = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => '__MOCK_SERVER_TIMESTAMP__',
        increment: (n) => ({ _mockIncrement: n })
      }
    }
  };

  db = {
    collection: (name) => new MockCollectionRef(name),
    batch: () => {
      const operations = [];
      return {
        set: (docRef, data) => {
          operations.push(() => MockDatabase.setDoc(docRef.collectionName, docRef.id, data));
        },
        update: (docRef, data) => {
          operations.push(() => MockDatabase.updateDoc(docRef.collectionName, docRef.id, data));
        },
        async commit() {
          operations.forEach(op => op());
        }
      };
    },
    async runTransaction(transactionFn) {
      const tx = {
        get: async (docRef) => docRef.get(),
        set: (docRef, data) => MockDatabase.setDoc(docRef.collectionName, docRef.id, data),
        update: (docRef, data) => MockDatabase.updateDoc(docRef.collectionName, docRef.id, data)
      };
      return transactionFn(tx);
    }
  };
}
