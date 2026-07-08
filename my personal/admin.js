// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7dprFu5MIL4EgW0lJ0EkbBZeNguF4d3c",
    authDomain: "digital-khata-64fa9.firebaseapp.com",
    projectId: "digital-khata-64fa9",
    storageBucket: "digital-khata-64fa9.firebasestorage.app",
    messagingSenderId: "942531584479",
    appId: "1:942531584479:web:571ff0eff5e0b1c266e46a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== SUPER ADMIN CREDENTIALS ====================
const MASTER_ADMIN_EMAIL = "admin@khata.com"; 

// ==================== DOM ELEMENTS ====================
const loginScreen = document.getElementById('admin-login-screen');
const dashboardScreen = document.getElementById('admin-dashboard-screen');
const loginForm = document.getElementById('admin-login-form');
const shopsListContainer = document.getElementById('admin-shops-list');
const searchInput = document.getElementById('admin-search-shop');

let allShopsData = [];

// ==================== 1. SECURE AUTHENTICATION ====================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    if (email !== MASTER_ADMIN_EMAIL) {
        alert("Access Denied! You are not authorized.");
        return;
    }

    try {
        // FIX: सेशन को इसी टैब तक सीमित रखने के लिए setPersistence
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
    } catch (error) {
        alert("Invalid Admin Credentials!");
    }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user && user.email === MASTER_ADMIN_EMAIL) {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadAllShops();
    } else {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
});

// ==================== 2. LOAD & RENDER SHOPS ====================
function loadAllShops() {
    onSnapshot(collection(db, "khata_shops"), (snapshot) => {
        allShopsData = [];
        let totalShops = 0;
        let premiumShops = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allShopsData.push({ id: docSnap.id, ...data });
            
            totalShops++;
            if (data.isPremium) premiumShops++;
        });

        document.getElementById('total-shops-count').innerText = totalShops;
        document.getElementById('premium-shops-count').innerText = premiumShops;

        renderShops(allShopsData);
    }, (error) => {
        console.error("Error loading shops:", error);
        alert("Failed to fetch shops data.");
    });
}

function renderShops(shopsArray) {
    shopsListContainer.innerHTML = '';

    if (shopsArray.length === 0) {
        shopsListContainer.innerHTML = '<div class="empty-state">No shops registered yet.</div>';
        return;
    }

    shopsArray.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    shopsArray.forEach(shop => {
        const isBlocked = shop.isBlocked || false;
        const isPremium = shop.isPremium || false;

        let badgeHTML = '';
        if (isBlocked) {
            badgeHTML = `<span class="badge badge-blocked">Blocked</span>`;
        } else if (isPremium) {
            badgeHTML = `<span class="badge badge-premium">Premium</span>`;
        } else {
            badgeHTML = `<span class="badge badge-free">Free Plan</span>`;
        }

        const card = document.createElement('div');
        card.className = 'admin-shop-card';
        card.innerHTML = `
            <div class="shop-header">
                <h4>${shop.shopName}</h4>
                ${badgeHTML}
            </div>
            <div class="shop-details">
                <p><strong><i class="fa-solid fa-phone"></i> Phone:</strong> ${shop.phone}</p>
                <p><strong><i class="fa-solid fa-key"></i> Password:</strong> ${shop.password || 'Hidden'}</p>
                <p><strong><i class="fa-solid fa-calendar"></i> Joined:</strong> ${shop.createdAt ? shop.createdAt.toDate().toLocaleDateString('en-IN') : 'N/A'}</p>
            </div>
            <div class="admin-actions">
                ${!isPremium 
                    ? `<button class="btn-sm btn-premium" onclick="makePremium('${shop.id}')"><i class="fa-solid fa-star"></i> Premium</button>` 
                    : `<button class="btn-sm btn-premium" style="background:gray;" onclick="removePremium('${shop.id}')"><i class="fa-solid fa-times"></i> Free</button>`}
                
                ${!isBlocked 
                    ? `<button class="btn-sm btn-block-action" onclick="toggleBlock('${shop.id}', true)"><i class="fa-solid fa-ban"></i> Block</button>` 
                    : `<button class="btn-sm btn-unblock" onclick="toggleBlock('${shop.id}', false)"><i class="fa-solid fa-check-circle"></i> Unblock</button>`}
                
                <button class="btn-sm btn-delete" onclick="deleteShop('${shop.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        `;
        shopsListContainer.appendChild(card);
    });
}

// ==================== 3. SEARCH FUNCTIONALITY ====================
searchInput.addEventListener('input', (e) => {
    const queryText = e.target.value.toLowerCase();
    const filteredShops = allShopsData.filter(shop => 
        (shop.shopName && shop.shopName.toLowerCase().includes(queryText)) || 
        (shop.phone && shop.phone.includes(queryText))
    );
    renderShops(filteredShops);
});

// ==================== 4. ADMIN ACTIONS (Global Functions) ====================
window.makePremium = async (shopId) => {
    if(confirm("क्या आप सच में इस दुकानदार को Premium बनाना चाहते हैं?")) {
        await updateDoc(doc(db, "khata_shops", shopId), { isPremium: true });
    }
};

window.removePremium = async (shopId) => {
    if(confirm("क्या आप इसे वापस Free Plan में डालना चाहते हैं?")) {
        await updateDoc(doc(db, "khata_shops", shopId), { isPremium: false });
    }
};

window.toggleBlock = async (shopId, blockStatus) => {
    const action = blockStatus ? "BLOCK (सस्पेंड)" : "UNBLOCK (चालू)";
    if(confirm(`क्या आप इस दुकानदार का अकाउंट ${action} करना चाहते हैं?`)) {
        await updateDoc(doc(db, "khata_shops", shopId), { isBlocked: blockStatus });
    }
};

window.deleteShop = async (shopId) => {
    if(confirm("⚠️ चेतावनी: क्या आप इस दुकानदार का पूरा अकाउंट हमेशा के लिए डिलीट करना चाहते हैं? इससे उनका सारा डेटा हट जाएगा।")) {
        await deleteDoc(doc(db, "khata_shops", shopId));
    }
};
