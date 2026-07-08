// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// ==================== GLOBAL VARIABLES ====================
let currentUserUID = null;
let currentCustomer = null;
let customerCount = 0;
let isPremiumUser = false;
let transactionType = "";
let transactionUnsubscribe = null; 

// ==================== DOM ELEMENTS ====================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const ledgerScreen = document.getElementById('ledger-screen');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const customerModal = document.getElementById('customer-modal');
const transModal = document.getElementById('transaction-modal');
const forgotModal = document.getElementById('forgot-password-modal');
const changePassModal = document.getElementById('change-password-modal');

// ==================== 1. UI TOGGLES ====================
document.getElementById('show-signup').addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

function showScreen(screen) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.add('hidden');
    ledgerScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// ==================== 2. AUTHENTICATION ====================
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const pin = document.getElementById('signup-pin').value;
    const dummyEmail = `${phone}@khata.com`;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCredential.user;

        await setDoc(doc(db, "khata_shops", user.uid), {
            shopName: shopName,
            phone: phone,
            password: password, 
            recoveryPin: pin,
            isPremium: false,
            isBlocked: false,
            createdAt: serverTimestamp()
        });

        alert("Account Created Successfully!");
        signupForm.reset();
        document.getElementById('show-login').click();
    } catch (error) {
        alert("Error: " + error.message);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    const dummyEmail = `${phone}@khata.com`;
    const loginBtn = document.querySelector('#login-form button');
    
    loginBtn.disabled = true;
    loginBtn.innerText = "Logging in...";

    try {
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, dummyEmail, password);
        loginForm.reset();
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";
    } catch (error) {
        alert("Invalid Mobile Number or Password!");
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// ==================== 3. FORGOT & CHANGE PASSWORD ====================
document.getElementById('show-forgot-password').addEventListener('click', () => forgotModal.classList.remove('hidden'));
document.getElementById('close-forgot-modal').addEventListener('click', () => {
    forgotModal.classList.add('hidden');
    document.getElementById('forgot-password-form').reset();
    document.getElementById('recovered-password-display').classList.add('hidden');
});

document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('forgot-phone').value;
    const pin = document.getElementById('forgot-pin').value;
    try {
        const q = query(collection(db, "khata_shops"), where("phone", "==", phone));
        const querySnapshot = await getDocs(q);
        if(querySnapshot.empty) { alert("No account found!"); return; }
        let userData = null;
        querySnapshot.forEach((docSnap) => { userData = docSnap.data(); });
        if(userData.recoveryPin === pin) {
            document.getElementById('show-recovered-password').innerText = userData.password;
            document.getElementById('recovered-password-display').classList.remove('hidden');
        } else {
            alert("Incorrect 4-Digit Recovery PIN!");
        }
    } catch (error) { alert("Error: " + error.message); }
});

document.getElementById('open-change-password-btn').addEventListener('click', () => changePassModal.classList.remove('hidden'));
document.getElementById('close-change-pass-modal').addEventListener('click', () => {
    changePassModal.classList.add('hidden');
    document.getElementById('change-password-form').reset();
});

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-pass-input').value;
    const user = auth.currentUser;
    if(!user) return;
    try {
        await updatePassword(user, newPass);
        await setDoc(doc(db, "khata_shops", user.uid), { password: newPass }, { merge: true });
        alert("Password updated successfully!");
        changePassModal.classList.add('hidden');
        document.getElementById('change-password-form').reset();
    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            alert("Please log out and log in again to change your password.");
        } else { alert("Error: " + error.message); }
    }
});

// ==================== 4. REAL-TIME AUTH & ADMIN CONTROL LISTENER ====================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUID = user.uid;
        const shopRef = doc(db, "khata_shops", currentUserUID);
        onSnapshot(shopRef, (docSnap) => {
            if (docSnap.exists()) {
                const shopData = docSnap.data();
                if (shopData.isBlocked) {
                    alert("⚠️ Your account has been suspended by the Admin.");
                    signOut(auth); 
                    return;
                }
                isPremiumUser = shopData.isPremium;
                const premiumBadge = isPremiumUser ? ' <i class="fa-solid fa-star" style="color:#f59e0b; font-size:12px;"></i>' : '';
                document.getElementById('shop-name-display').innerHTML = shopData.shopName + premiumBadge;
                showScreen(dashboardScreen);
                loadCustomers();
            } else {
                alert("❌ Your account has been deleted.");
                signOut(auth);
            }
        });
    } else {
        currentUserUID = null;
        showScreen(loginScreen);
    }
});

// ==================== 5. CUSTOMER MANAGEMENT ====================
document.getElementById('open-add-customer-modal').addEventListener('click', () => {
    if (customerCount >= 60 && !isPremiumUser) {
        alert("Free Limit Reached! Contact Admin."); return;
    }
    customerModal.classList.remove('hidden');
});

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
});

document.getElementById('add-customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-cust-name').value;
    const phone = document.getElementById('new-cust-phone').value;
    try {
        await addDoc(collection(db, "khata_customers"), {
            shopUID: currentUserUID, name: name, phone: phone, totalDue: 0, createdAt: serverTimestamp()
        });
        customerModal.classList.add('hidden');
        document.getElementById('add-customer-form').reset();
    } catch (error) { alert("Error: " + error.message); }
});

function loadCustomers() {
    const q = query(collection(db, "khata_customers"), where("shopUID", "==", currentUserUID));
    onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const listDiv = document.getElementById('customer-list');
        listDiv.innerHTML = '';
        let totalShopDue = 0;
        customerCount = snapshot.docs.length;
        if (snapshot.empty) {
            listDiv.innerHTML = '<div class="empty-state">No customers found.</div>';
            document.getElementById('total-due-amount').innerText = "0";
            document.getElementById('total-collected-amount').innerText = "0";
            return;
        }
        const customers = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => {
                const timeA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : Date.now() + 100000;
                const timeB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : Date.now() + 100000;
                return timeB - timeA;
            });
            
        customers.forEach((data) => {
            if (data.totalDue > 0) totalShopDue += data.totalDue;
            const card = document.createElement('div');
            card.className = 'customer-card';
            const balanceClass = data.totalDue > 0 ? 'color: #ef4444;' : (data.totalDue < 0 ? 'color: #22c55e;' : 'color: #1f2937;');
            const balanceText = data.totalDue >= 0 ? `₹ ${data.totalDue}` : `Adv: ₹ ${Math.abs(data.totalDue)}`;
            card.innerHTML = `
                <div class="customer-info">
                    <h4>${data.name}</h4>
                    <p><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${data.phone}</p>
                </div>
                <div style="font-weight: 700; font-size: 17px; ${balanceClass}">${balanceText}</div>
            `;
            card.addEventListener('click', () => openLedger(data.id, data.name, data.phone, data.totalDue));
            listDiv.appendChild(card);
        });
        document.getElementById('total-due-amount').innerText = totalShopDue;
        calculateTodayCollection(); 
    });
}

function calculateTodayCollection() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(collection(db, "khata_transactions"), where("shopUID", "==", currentUserUID), where("type", "==", "GOT"));
    onSnapshot(q, (snapshot) => {
        let todayCollection = 0;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.date && data.date.toDate() >= today) todayCollection += data.amount;
        });
        document.getElementById('total-collected-amount').innerText = todayCollection;
    });
}

// ==================== 6. LEDGER & TRANSACTIONS ====================
function openLedger(id, name, phone, balance) {
    currentCustomer = { id, name, phone, balance };
    document.getElementById('current-customer-name').innerText = name;
    document.getElementById('current-customer-phone').innerText = `Phone: ${phone}`;
    document.getElementById('current-customer-balance').innerText = `₹ ${balance}`;
    showScreen(ledgerScreen);
    loadTransactions(id);
}

document.getElementById('back-to-dashboard').addEventListener('click', () => showScreen(dashboardScreen));
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

// 🚀 FIX: Transaction Submit Logic (अब यह तुरंत काम करेगा)
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const amountInput = document.getElementById('trans-amount');
    const remarksInput = document.getElementById('trans-remarks');
    
    const amount = parseFloat(amountInput.value);
    let remarks = remarksInput.value.trim();
    
    // अगर कोई रिमार्क नहीं डाला, तो डिफ़ॉल्ट रिमार्क सेट करें
    if (!remarks) {
        remarks = (transactionType === 'GAVE') ? 'Goods given (Uudhar)' : 'Cash received (Jama)';
    }

    if (!currentCustomer || isNaN(amount) || amount <= 0) {
        alert("कृपया सही अमाउंट दर्ज करें!");
        return;
    }

    const submitBtn = document.getElementById('submit-trans-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = "Saving...";

    try {
        // Firestore में एंट्री
        await addDoc(collection(db, "khata_transactions"), {
            customerID: currentCustomer.id,
            shopUID: currentUserUID,
            type: transactionType,
            amount: amount,
            remarks: remarks,
            date: serverTimestamp()
        });

        // बैलेंस अपडेट करें
        const newBalance = transactionType === 'GAVE' ? currentCustomer.balance + amount : currentCustomer.balance - amount;
        await setDoc(doc(db, "khata_customers", currentCustomer.id), { totalDue: newBalance }, { merge: true });

        // UI बैलेंस अपडेट
        currentCustomer.balance = newBalance;
        document.getElementById('current-customer-balance').innerText = `₹ ${newBalance}`;

        transModal.classList.add('hidden');
        document.getElementById('transaction-form').reset();
    } catch (error) { 
        alert("Error: " + error.message); 
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Save Entry";
    }
});

function loadTransactions(customerID) {
    if (transactionUnsubscribe) transactionUnsubscribe();
    
    const q = query(collection(db, "khata_transactions"), where("customerID", "==", customerID));
    
    // 🚀 FIX: includeMetadataChanges: true (लोकल एंट्री को तुरंत UI में दिखाएगा)
    transactionUnsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const listDiv = document.getElementById('transaction-list');
        listDiv.innerHTML = '';
        
        if (snapshot.empty) {
            listDiv.innerHTML = '<div class="empty-state">No transactions found.</div>';
            return;
        }
        
        const transactions = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            // पेंडिंग ट्रांजैक्शन (जब तक सर्वर पर न जाए) को फ्यूचर टाइम दो, ताकि पक्का टॉप पर रहे
            const sortTime = data.date && typeof data.date.toMillis === 'function' 
                ? data.date.toMillis() 
                : Date.now() + 100000; 
            return { id: docSnap.id, sortTime: sortTime, ...data };
        }).sort((a, b) => b.sortTime - a.sortTime); // नया सबसे ऊपर
        
        transactions.forEach((data) => {
            const dateObj = data.date ? data.date.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            
            const isGave = data.type === 'GAVE';
            const color = isGave ? '#ef4444' : '#22c55e'; // उधार के लिए लाल, जमा के लिए हरा
            const sign = isGave ? '-' : '+';
            
            const card = document.createElement('div');
            card.className = `trans-card ${isGave ? 'trans-gave' : 'trans-got'}`;
            
            // 🚀 FIX: Inline CSS Backup (यह लाल एंट्री को छिपने से रोकेगा)
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.background = 'rgba(255,255,255,0.9)';
            card.style.padding = '14px 16px';
            card.style.marginBottom = '12px';
            card.style.borderRadius = '12px';
            card.style.borderLeft = `4px solid ${color}`;
            card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
            
            card.innerHTML = `
                <div class="trans-details">
                    <p class="date" style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${dateStr}</p>
                    <p class="remark" style="font-size: 14px; font-weight: 600; color: #1f2937;">${data.remarks}</p>
                </div>
                <div class="trans-amount" style="font-weight: 700; font-size: 16px; color: ${color};">
                    ${sign} ₹${data.amount}
                </div>
            `;
            listDiv.appendChild(card);
        });
    });
}

// ==================== 7. SEARCH & WHATSAPP FUNCTIONS ====================
document.getElementById('customer-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const customerCards = document.querySelectorAll('.customer-card');
    customerCards.forEach(card => {
        const name = card.querySelector('h4').innerText.toLowerCase();
        const phone = card.querySelector('p').innerText;
        card.style.display = (name.includes(searchTerm) || phone.includes(searchTerm)) ? 'flex' : 'none';
    });
});

document.getElementById('whatsapp-remind-btn').addEventListener('click', () => {
    if (!currentCustomer) return;
    let message = currentCustomer.balance > 0 ? `नमस्ते ${currentCustomer.name},\nआपका बकाया (Due Balance) ₹${currentCustomer.balance} है।` : `नमस्ते ${currentCustomer.name},\nआपका ₹${Math.abs(currentCustomer.balance)} एडवांस जमा है।`;
    window.open(`https://wa.me/91${currentCustomer.phone}?text=${encodeURIComponent(message)}`, '_blank');
});
                        
