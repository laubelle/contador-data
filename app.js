const CHAVE = "contadores";

function carregar() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || [];
  } catch {
    return [];
  }
}

function salvar(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
    return true;
  } catch {
    alert("Não foi possível salvar. O armazenamento do navegador pode estar cheio.");
    return false;
  }
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function corValida(valor) {
  return /^#[0-9a-f]{6}$/i.test(valor) ? valor : "#d3968c";
}

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function ehEscuro(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

const MS_DIA = 24 * 60 * 60 * 1000;

function hoje() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function lerData(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function somarDias(data, n) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + n);
}

function somarAnos(data, n) {
  const ano = data.getFullYear() + n;
  const mes = data.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(data.getDate(), ultimoDia));
}

function diferencaDias(a, b) {
  return Math.round((a - b) / MS_DIA);
}

function gerarMarcos(inicio, limiteAnos = 20) {
  const marcos = new Map();  // dias -> data (o Map evita repetir o mesmo marco)

  for (let d = 100; d <= 365 * limiteAnos; d += 100) {
    marcos.set(d, somarDias(inicio, d));
  }
  for (let a = 1; a <= limiteAnos; a++) {
    const data = somarAnos(inicio, a);
    marcos.set(diferencaDias(data, inicio), data);
  }

  return [...marcos.keys()]
    .sort((x, y) => x - y)
    .map(d => ({ dias: d, data: marcos.get(d) }));
}

function calcular(c) {
  const inicio = lerData(c.inicio);
  const dias = diferencaDias(hoje(), inicio);

  const todos = gerarMarcos(inicio);
  const passados = todos.filter(m => m.dias <= dias);
  const futuros = todos.filter(m => m.dias > dias);

  const proximo = futuros.length ? futuros[0].dias : null;
  const anterior = passados.length ? passados[passados.length - 1].dias : 0;
  const progresso = proximo
    ? Math.round((dias - anterior) / (proximo - anterior) * 100)
    : 100;

  return {
    ...c,
    dias,
    proximo,
    faltam: proximo ? proximo - dias : null,
    progresso,
    proximos: futuros.slice(0, 3),
    ultimos: passados.slice(-3).reverse(),
    marcoHoje: dias > 0 && todos.some(m => m.dias === dias),
  };
}

function reduzirImagem(arquivo, lado = 160) {
  return new Promise(resolve => {
    if (!arquivo) return resolve(null);
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function htmlCard(c) {
  const cor = corValida(c.cor);
  const dataBr = m => m.data.toLocaleDateString("pt-BR");

  return `
    <div class="card${ehEscuro(cor) ? " escuro" : ""}" style="--cor: ${cor}">
      ${c.marcoHoje ? '<img class="selo" src="selo.png" alt="Data especial">' : ""}
      <div class="cabecalho">
        ${c.icone ? `<img class="icone" src="${esc(c.icone)}" alt="">` : ""}
        <h2>${c.icone ? "" : esc(c.emoji || "💖") + " "}${esc(c.nome)}</h2>
      </div>
      <p>${c.dias} dias</p>
      ${c.proximo ? `
        <p class="proximo">
          Próximo marco: <strong>${c.proximo} dias</strong>
          <span class="faltam">(faltam ${c.faltam})</span>
        </p>
        <div class="barra">
          <div class="barra-preenchida" style="width: ${c.progresso}%"></div>
        </div>
        <h3 class="titulo-lista">Próximos</h3>
        <ul class="lista-marcos">
          ${c.proximos.map(m => `<li>${m.dias} dias: ${dataBr(m)}</li>`).join("")}
        </ul>` : ""}
      ${c.ultimos.length ? `
        <h3 class="titulo-lista">Já conquistados</h3>
        <ul class="lista-marcos conquistados">
          ${c.ultimos.map(m => `<li>✓ ${m.dias} dias: ${dataBr(m)}</li>`).join("")}
        </ul>` : ""}
      <a href="editar.html?id=${encodeURIComponent(c.id)}">Editar</a>
      <form data-excluir="${esc(c.id)}"><button>Excluir</button></form>
    </div>`;
}

function desenhar() {
  document.getElementById("lista").innerHTML =
    carregar().map(calcular).map(htmlCard).join("");
}

function iniciarIndex() {
  desenhar();

  document.getElementById("form-novo").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const icone = await reduzirImagem(f.icone.files[0]);
    const lista = carregar();
    lista.push({
      id: novoId(),
      nome: f.nome.value.trim(),
      inicio: f.inicio.value,
      cor: corValida(f.cor.value),
      emoji: f.emoji.value || "💖",
      icone,
    });
    if (salvar(lista)) {
      f.reset();
      desenhar();
    }
  });

  document.getElementById("lista").addEventListener("submit", e => {
    const id = e.target.dataset.excluir;
    if (!id) return;
    e.preventDefault();
    if (!confirm("Excluir este contador?")) return;
    salvar(carregar().filter(c => c.id !== id));
    desenhar();
  });
}

function iniciarEditar() {
  const id = new URLSearchParams(location.search).get("id");
  const lista = carregar();
  const c = lista.find(x => x.id === id);
  if (!c) {
    location.href = "index.html";
    return;
  }

  const f = document.getElementById("form-editar");
  f.nome.value = c.nome;
  f.inicio.value = c.inicio;
  f.cor.value = corValida(c.cor);
  f.emoji.value = c.emoji || "";

  f.addEventListener("submit", async e => {
    e.preventDefault();
    c.nome = f.nome.value.trim();
    c.inicio = f.inicio.value;
    c.cor = corValida(f.cor.value);
    c.emoji = f.emoji.value;
    const novo = await reduzirImagem(f.icone.files[0]);
    if (novo) c.icone = novo;
    if (salvar(lista)) location.href = "index.html";
  });
}

const pagina = document.body.dataset.pagina;
if (pagina === "index") iniciarIndex();
if (pagina === "editar") iniciarEditar();