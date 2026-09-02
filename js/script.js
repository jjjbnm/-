document.addEventListener("DOMContentLoaded", () => {
    // בוחר את כל הכפתורים באתר
    const buttons = document.querySelectorAll("button, .btn");

    buttons.forEach(button => {
        // הוספת אפקט לחיצה ויזואלי לכל כפתור
        button.addEventListener("mousedown", () => {
            button.style.transform = "scale(0.95)";
        });

        button.addEventListener("mouseup", () => {
            button.style.transform = "scale(1)";
        });

        button.addEventListener("mouseleave", () => {
            button.style.transform = "scale(1)";
        });

        // האזנה ללחיצה אמיתית על הכפתור
        button.addEventListener("click", (event) => {
            const buttonId = event.target.id;
            
            // כאן אפשר להגדיר מה כל כפתור יעשה לפי ה-ID שלו
            if (buttonId === "mySpecialButton") {
                console.Hologram ? "" : null; // דוגמה לפעולה מיוחדת
                alert("הכפתור המיוחד נלחץ בהצלחה!");
            } else {
                console.log("כפתור נלחץ:", event.target.innerText);
            }
        });
    });
});
