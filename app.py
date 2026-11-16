import json, uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from flask import Flask, render_template, request, redirect
from dateutil.relativedelta import relativedelta
import os
app = Flask(__name__)
ARQUIVO = Path("data.json")
PASTA_UPLOADS = os.path.join(app.static_folder, "uploads")
EXTENSOES = {"png", "jpg", "jpeg", "gif", "webp"}
os.makedirs(PASTA_UPLOADS, exist_ok=True)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # limite de 2 MB

def salvar_icone(arquivo):
    if not arquivo or not arquivo.filename:
        return None
    ext = arquivo.filename.rsplit(".", 1)[-1].lower()
    if ext not in EXTENSOES:
        return None
    nome = f"{uuid.uuid4().hex}.{ext}"
    arquivo.save(os.path.join(PASTA_UPLOADS, nome))
    return nome

def gerar_marcos(inicio, limite_anos=20):
    marcos = {}  # dias -> data (dicionário evita repetir o mesmo marco)

    # de 100 em 100 dias
    for d in range(100, 365 * limite_anos + 1, 100):
        marcos[d] = inicio + timedelta(days=d)

    # de ano em ano
    for a in range(1, limite_anos + 1):
        data = inicio + relativedelta(years=a)
        marcos[(data - inicio).days] = data

    return [{"dias": d, "data": marcos[d]} for d in sorted(marcos)]

def carregar():
    if ARQUIVO.exists():
        return json.loads(ARQUIVO.read_text(encoding="utf-8"))
    return []

def salvar(contadores):
    ARQUIVO.write_text(json.dumps(contadores, ensure_ascii=False, indent=2), encoding="utf-8")

def calcular(c):
    marcos_lista = c.get("marcos")
    inicio = datetime.strptime(c["inicio"], "%Y-%m-%d").date()
    hoje = date.today()
    dias = (hoje - inicio).days

    todos = gerar_marcos(inicio)
    passados = [m for m in todos if m["dias"] <= dias]
    futuros = [m for m in todos if m["dias"] > dias]

    proximo = futuros[0]["dias"] if futuros else None
    anterior = passados[-1]["dias"] if passados else 0

    if proximo:
        # progresso entre o marco anterior e o próximo
        progresso = round((dias - anterior) / (proximo - anterior) * 100)
    else:
        progresso = 100

    return {
        **c,
        "dias": dias,
        "proximo_marco": proximo,
        "faltam": proximo - dias if proximo else None,
        "progresso": progresso,
        "proximos": futuros[:3],
        "ultimos": passados[-3:][::-1],  # do mais recente pro mais antigo
        "marcos": todos,                 # lista completa
    }

@app.route("/")
def index():
    return render_template("index.html", contadores=[calcular(c) for c in carregar()])

@app.route("/novo", methods=["POST"])
def novo():
    contadores = carregar()
    icone = salvar_icone(request.files.get("icone"))
    contadores.append({
        "id": uuid.uuid4().hex[:8],
        "nome": request.form["nome"],
        "inicio": request.form["inicio"],
        "cor": request.form.get("cor", "#d3968c"),
        "emoji": request.form.get("emoji", "💖"),
        "icone": icone,
    })
    salvar(contadores)
    return redirect("/")

@app.route("/editar/<id>", methods=["GET", "POST"])
def editar(id):
    contadores = carregar()
    c = next((x for x in contadores if x["id"] == id), None)
    if c is None:
        return redirect("/")
    if request.method == "POST":
        c["nome"] = request.form["nome"]
        c["inicio"] = request.form["inicio"]
        c["cor"] = request.form.get("cor", c["cor"])
        c["emoji"] = request.form.get("emoji", c["emoji"])
        novo_icone = salvar_icone(request.files.get("icone"))
        if novo_icone:
            c["icone"] = novo_icone
        salvar(contadores)
        return redirect("/")
    return render_template("editar.html", c=c)

@app.route("/excluir/<id>", methods=["POST"])
def excluir(id):
    salvar([c for c in carregar() if c["id"] != id])
    return redirect("/")

if __name__ == "__main__":
    app.run(debug=True)