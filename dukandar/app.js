// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC0P1T-OxFHBYSWq9m5xHdL-tiDdQXsgsY",
    authDomain: "smart-mobile-care-19839.firebaseapp.com",
    projectId: "smart-mobile-care-19839",
    storageBucket: "smart-mobile-care-19839.firebasestorage.app",
    messagingSenderId: "660542073783",
    appId: "1:660542073783:web:f9e6bc7a733b1701105632"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== GLOBAL VARIABLES ====================
let currentUserUID = null;
let currentCustomer = null;
let customerCount = 0;
let isPremiumUser = false;
let transactionType = ""; // 'GAVE' or 'GOT'

// ==================== DOM ELEMENTS ====================
// Screens
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const ledgerScreen = document.getElementById('ledger-screen');

// Auth UI
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// Modals
const customerModal = document.getElementById('customer-modal');
const transModal = document.getElementById('transaction-modal');

// ==================== 1. UI TOGGLES ====================
showSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

function showScreen(screen) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.add('hidden');
    ledgerScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// ==================== 2. AUTHENTICATION (Login / Signup) ====================
// Sign Up
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const dummyEmail = `${phone}@khata.com`;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCredential.user;

        await setDoc(doc(db, "khata_shops", user.uid), {
            shopName: shopName,
            phone: phone,
            isPremium: false,
            createdAt: serverTimestamp()
        });

        alert("Account Created Successfully!");
        signupForm.reset();
    } catch (error) {
        alert("Error: " + error.message);
    }
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    const dummyEmail = `${phone}@khata.com`;

    try {
        await signInWithEmailAndPassword(auth, dummyEmail, password);
        loginForm.reset();
    } catch (error) {
        alert("Invalid Mobile Number or Password!");
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// ==================== 3. REAL-TIME AUTH LISTENER ====================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUID = user.uid;
        showScreen(dashboardScreen);

        const shopDoc = await getDoc(doc(db, "khata_shops", currentUserUID));
        if (shopDoc.exists()) {
            document.getElementById('shop-name-display').innerText = shopDoc.data().shopName;
            isPremiumUser = shopDoc.data().isPremium;
        }

        loadCustomers();
    } else {
        currentUserUID = null;
        showScreen(loginScreen);
    }
});

// ==================== 4. CUSTOMER MANAGEMENT ====================
document.getElementById('open-add-customer-modal').addEventListener('click', () => {
    if (customerCount >= 60 && !isPremiumUser) {
        alert("Free Limit Reached (60 Customers)! Please contact Admin on WhatsApp to upgrade to Premium.");
        return;
    }
    customerModal.classList.remove('hidden');
});

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        customerModal.classList.add('hidden');
        transModal.classList.add('hidden');
    });
});

document.getElementById('add-customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-cust-name').value;
    const phone = document.getElementById('new-cust-phone').value;

    try {
        await addDoc(collection(db, "khata_customers"), {
            shopUID: currentUserUID,
            name: name,
            phone: phone,
            totalDue: 0,
            createdAt: serverTimestamp()
        });

        customerModal.classList.add('hidden');
        document.getElementById('add-customer-form').reset();
    } catch (error) {
        alert("Error adding customer: " + error.message);
    }
});

function loadCustomers() {
    const q = query(
        collection(db, "khata_customers"),
        where("shopUID", "==", currentUserUID)
    );

    onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById('customer-list');
        listDiv.innerHTML = '';
        let totalShopDue = 0;
        customerCount = snapshot.docs.length;

        if (snapshot.empty) {
            listDiv.innerHTML = '<div class="empty-state">No customers found. Add a new customer to get started.</div>';
            document.getElementById('total-due-amount').innerText = "0";
            return;
        }

        const customers = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });

        customers.forEach((data) => {
            if (data.totalDue > 0) totalShopDue += data.totalDue;

            const card = document.createElement('div');
            card.className = 'customer-card';

            const balanceClass = data.totalDue > 0 ? 'balance-red' : (data.totalDue < 0 ? 'balance-green' : '');
            const balanceText = data.totalDue >= 0 ? `₹ ${data.totalDue}` : `Adv: ₹ ${Math.abs(data.totalDue)}`;

            card.innerHTML = `
                <div class="customer-info">
                    <h4>${data.name}</h4>
                    <p><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${data.phone}</p>
                </div>
                <div class="customer-balance ${balanceClass}">${balanceText}</div>
            `;

            card.addEventListener('click', () => openLedger(data.id, data.name, data.phone, data.totalDue));
            listDiv.appendChild(card);
        });

        document.getElementById('total-due-amount').innerText = totalShopDue;
    }, (error) => {
        console.error("Load customers error:", error);
        alert("Customers load nahi ho rahe. Console check karo.");
    });
}

// ==================== 5. LEDGER & TRANSACTIONS ====================
function openLedger(id, name, phone, balance) {
    currentCustomer = { id, name, phone, balance };
    document.getElementById('current-customer-name').innerText = name;
    document.getElementById('current-customer-phone').innerText = `Phone: ${phone}`;
    document.getElementById('current-customer-balance').innerText = `₹ ${balance}`;

    showScreen(ledgerScreen);
    loadTransactions(id);
}

document.getElementById('back-to-dashboard').addEventListener('click', () => showScreen(dashboardScreen));

// WhatsApp Integration
document.getElementById('whatsapp-remind-btn').addEventListener('click', () => {
    if (!currentCustomer) return;

    const shopName = document.getElementById('shop-name-display').innerText;
    const msg = `Namaste ${currentCustomer.name},\n\nAapka ${shopName} par ₹${currentCustomer.balance} ka udhaar baki hai. Kripya samay par jama karein.\n\nThank you!`;
    const whatsappUrl = `https://wa.me/91${currentCustomer.phone}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
});

// Add Transaction UI
document.getElementById('btn-gave-uudhar').addEventListener('click', () => {
    transactionType = "GAVE";
    document.getElementById('transaction-modal-title').innerText = "You Gave (Uudhar)";
    document.getElementById('submit-trans-btn').className = "btn btn-danger btn-block";
    transModal.classList.remove('hidden');
});

document.getElementById('btn-got-jama').addEventListener('click', () => {
    transactionType = "GOT";
    document.getElementById('transaction-modal-title').innerText = "You Got (Jama)";
    document.getElementById('submit-trans-btn').className = "btn btn-success btn-block";
    transModal.classList.remove('hidden');
});

// Save Transaction
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const remarks = document.getElementById('trans-remarks').value;

    if (!currentCustomer) return;

    try {
        await addDoc(collection(db, "khata_transactions"), {
            customerID: currentCustomer.id,
            shopUID: currentUserUID,
            type: transactionType,
            amount: amount,
            remarks: remarks || (transactionType === 'GAVE' ? 'Goods given' : 'Cash received'),
            date: serverTimestamp()
        });

        const newBalance = transactionType === 'GAVE'
            ? currentCustomer.balance + amount
            : currentCustomer.balance - amount;

        await setDoc(doc(db, "khata_customers", currentCustomer.id), {
            totalDue: newBalance
        }, { merge: true });

        currentCustomer.balance = newBalance;
        document.getElementById('current-customer-balance').innerText = `₹ ${newBalance}`;

        transModal.classList.add('hidden');
        document.getElementById('transaction-form').reset();
    } catch (error) {
        alert("Error saving entry: " + error.message);
    }
});

function loadTransactions(customerID) {
    const q = query(
        collection(db, "khata_transactions"),
        where("customerID", "==", customerID),
        orderBy("date", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById('transaction-list');
        listDiv.innerHTML = '';

        if (snapshot.empty) {
            listDiv.innerHTML = '<div class="empty-state">No transactions found.</div>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateObj = data.date ? data.date.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            const card = document.createElement('div');
            card.className = `trans-card ${data.type === 'GAVE' ? 'trans-gave' : 'trans-got'}`;

            card.innerHTML = `
                <div class="trans-details">
                    <p class="date">${dateStr}</p>
                    <p class="remark">${data.remarks}</p>
                </div>
                <div class="trans-amount ${data.type === 'GAVE' ? 'balance-red' : 'balance-green'}">
                    ${data.type === 'GAVE' ? '-' : '+'} ₹${data.amount}
                </div>
            `;

            listDiv.appendChild(card);
        });
    });
}
