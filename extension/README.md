# Mecatube DeepSeek Bridge

Browser extension (Manifest V3, Chrome/Brave 116+) that lets Mecatube chat through a
chat.deepseek.com tab. It only pastes your message, sends it, and reads the reply.

## Install

1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Log in to https://chat.deepseek.com in the same browser.
5. Open Mecatube. The Chat view shows "Extension connected" once the extension reaches the app.

The extension connects to `ws://127.0.0.1:47823`; Mecatube must be running.

## Maintenance

DeepSeek's page markup changes from time to time. All DOM selectors live in the `SELECTORS`
object at the top of `content.js`; adjust them there if sending or reading replies stops working.
After editing, click the reload icon on the extension card and reload the DeepSeek tab.
