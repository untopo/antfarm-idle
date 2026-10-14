#!/usr/bin/env python3
"""scripts/gh-login.py — deja gh autenticado sin pegar token en ningun chat.

El sandbox no tiene terminal, y `gh auth login` solo ofrece el flujo de dispositivo
por TTY. Aqui se abre un seudoterminal de verdad y se contesta lo que gh pregunte:

  * "? Authenticate Git with your GitHub credentials? (Y/n)"  -> Y
  * "Press Enter to open github.com in your browser..."       -> Enter
  * peticiones de posicion del cursor (ESC[6n)                -> respuesta valida
    (si no se contestan, la libreria de prompts de gh se queda colgada: eso fue
     exactamente lo que paso el primer dia)

Todo lo que imprime gh se copia a .deploy/gh.log volcando en cada lectura, para poder
leer el codigo de 8 caracteres MIENTRAS gh sigue esperando la autorizacion.

Uso:  python3 scripts/gh-login.py      (dejarlo corriendo; el codigo caduca en ~15 min)
Despues de que el usuario autorice:  gh auth status   -> ya se puede empujar.
"""
import os, pty, re, select, sys, time

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".deploy")
os.makedirs(D, exist_ok=True)
LOG = os.path.join(D, "gh.log")
CMD = ["gh", "auth", "login", "--hostname", "github.com",
       "--git-protocol", "https", "--web"]

def clean(b):
    b = re.sub(rb"\x1b\[[0-9;?]*[a-zA-Z]", b"", b)
    b = re.sub(rb"\x1b[()][A-Z0-9]", b"", b)
    return b.replace(b"\r", b"")

pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "dumb"
    os.execvp(CMD[0], CMD)

sent = {"yn": False, "enter": 0}
with open(LOG, "wb", buffering=0) as log:
    log.write(b"\n=== gh-login.py " + time.strftime("%Y-%m-%d %H:%M:%S").encode() + b" ===\n")
    deadline = time.time() + 900          # 15 min, lo que tarda en caducar el codigo de GitHub
    while time.time() < deadline:
        r, _, _ = select.select([fd], [], [], 2)
        if not r:
            # sin salida: por si acaso el prompt espera otro Enter
            if sent["yn"] and sent["enter"] < 4:
                sent["enter"] += 1
                os.write(fd, b"\r")
            continue
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        log.write(chunk); sys.stdout.write(clean(chunk).decode("utf-8", "replace")); sys.stdout.flush()
        if b"\x1b[6n" in chunk:                       # "donde esta el cursor?" -> arriba a la izquierda
            os.write(fd, b"\x1b[2;1R")
        low = clean(chunk)
        if b"(Y/n)" in low and not sent["yn"]:
            sent["yn"] = True
            time.sleep(0.4); os.write(fd, b"Y\r")
        elif (b"Press Enter" in low or b"one-time code" in low) and sent["enter"] < 2:
            sent["enter"] += 1
            time.sleep(0.6); os.write(fd, b"\r")
    log.write(b"\n=== gh-login.py: fin de la espera ===\n")
try:
    os.kill(pid, 15)
except ProcessLookupError:
    pass
