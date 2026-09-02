// script.js - קוד חסין לתקלות להפעלת כל הכפתורים והאינטראקציות

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. ניהול מעבר בין טאבים (Tab Switching)
    function switchTab(tabId) {
        if (!tabId) return;
        
        // הסרת פעילות מכל הטאבים והכפתורים
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.nav-btn, [data-tab]').forEach(btn => btn.classList.remove('active'));
        
        // הפעלת הטאב והכפתור המבוקש
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');
        
        const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // 2. האזנה לכל כפתורי הניווט
    document.querySelectorAll('[data-tab]').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // 3. החלפת מצב תצוגה (Dark / Light Theme)
    const themeBtn = document.getElementById('toggleThemeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
        });
    }

    // 4. ניהול חלונות קופצים (Modal Dialogs)
    const modal = document.getElementById('customModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtns = document.querySelectorAll('#closeModalBtn, #modalOkBtn, .close-modal');

    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', () => modal.classList.add('open'));
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (modal) modal.classList.remove('open');
        });
    });

    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    }

    // 5. עוזר AI מובנה
    const askAiBtn = document.getElementById('askAiBtn');
    const aiInput = document.getElementById('aiInput');
    const aiResponse = document.getElementById('aiResponse');

    if (askAiBtn) {
        askAiBtn.addEventListener('click', () => {
            if (aiInput && aiResponse) {
                const query = aiInput.value.trim();
                if (query !== '') {
                    aiResponse.innerText = `עוזר AI: קיבלתי את שאלתך "${query}". לפי חוקי קהילת רצף, יש לשמור על כללי הקבוצה!`;
                    aiInput.value = '';
                } else {
                    aiResponse.innerText = 'אנא הקלד שאלה לפני הלחיצה.';
                }
            }
        });
    }

    // 6. גיבוי גלובלי לכל כפתור ברשת (Event Delegation)
    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        // טיפול בלחיצה על כפתורי רכישה/תשלום
        if (button.innerText.includes('רכישת') || button.getAttribute('onclick')?.includes('openPaymentModal')) {
            const modalText = document.getElementById('modalText');
            if (modalText) modalText.innerText = 'מועבר לשער תשלום מאובטח (PayPal / Apple Pay)...';
            if (modal) modal.classList.add('open');
        }
    });
});

// פונקציה גלובלית לגיבוי במידה ומשתמשים ב-onclick בקוד ה-HTML
window.switchTab = function(tabId) {
    const event = new CustomEvent('changeTab', { detail: tabId });
    document.dispatchEvent(event);
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        targetTab.classList.add('active');
    }
};
