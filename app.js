// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://pinonhsrrsfvyemlusbr.supabase.co";
const SUPABASE_KEY = "sb_publishable_iq3dMg7U6zVz8vP6oSERYQ_nlXh7J_7";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIÁVEIS GLOBAIS DE ESTADO
let usuarioLogado = null;
let perfilUsuario = null;
let listaProdutos = [];

// CHAVE SECRETA PARA CADASTRO DE GERENTE
const CODIGO_GERENTE_SECRETO = "CANTINA2026";

// INICIALIZAÇÃO DA APLICAÇÃO
document.addEventListener("DOMContentLoaded", async () => {
  const hoje = new Date().toISOString().split("T")[0];
  const filtroData = document.getElementById("filtro-data");
  if (filtroData) filtroData.value = hoje;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    usuarioLogado = session.user;
    await carregarPerfilEIniciar();
  } else {
    exibirTelaAuth();
  }
});

// ALTERNA ENTRE LOGIN E CADASTRO
function toggleAuth(modo) {
  const formLogin = document.getElementById("form-login");
  const formCadastro = document.getElementById("form-cadastro");

  if (modo === "cadastro") {
    formLogin.classList.add("hidden");
    formCadastro.classList.remove("hidden");
  } else {
    formCadastro.classList.add("hidden");
    formLogin.classList.remove("hidden");
  }
}

// CADASTRO DE USUÁRIO
async function handleCadastro(e) {
  e.preventDefault();
  const nome = document.getElementById("cad-nome").value;
  const email = document.getElementById("cad-email").value;
  const senha = document.getElementById("cad-senha").value;
  const codigo = document.getElementById("cad-codigo").value;

  const perfil = (codigo === CODIGO_GERENTE_SECRETO) ? "gerente" : "vendedor";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: senha,
  });

  if (error) {
    alert("Erro no cadastro: " + error.message);
    return;
  }

  if (data.user) {
    const { error: perfilError } = await supabaseClient.from("perfis").insert([
      { id: data.user.id, nome: nome, perfil: perfil }
    ]);

    if (perfilError) console.error("Erro ao salvar perfil:", perfilError);

    alert(`Cadastro realizado com sucesso como ${perfil.toUpperCase()}! Faça login.`);
    toggleAuth("login");
  }
}

// LOGIN DE USUÁRIO
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      alert("Erro no login! Credencial inválida!");
    } else {
      alert("Erro no login: " + error.message);
    }
    return;
  }
  usuarioLogado = data.user;
  await carregarPerfilEIniciar();
}

// BUSCA O PERFIL DO USUÁRIO E CARREGA O PAINEL
async function carregarPerfilEIniciar() {
  const { data, error } = await supabaseClient
    .from("perfis")
    .select("nome, perfil")
    .eq("id", usuarioLogado.id)
    .single();

  if (data) {
    perfilUsuario = data;
  } else {
    perfilUsuario = { nome: usuarioLogado.email, perfil: "vendedor" };
  }

  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");

  document.getElementById("user-display").innerText = `Olá, ${perfilUsuario.nome}`;
  const badge = document.getElementById("badge-perfil");
  badge.innerText = perfilUsuario.perfil;
  badge.className = `badge ${perfilUsuario.perfil}`;

  if (perfilUsuario.perfil === "gerente") {
    document.getElementById("nav-gerente").classList.remove("hidden");
  }

  await carregarProdutos();
}

// LOGOUT
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

function exibirTelaAuth() {
  document.getElementById("auth-container").classList.remove("hidden");
  document.getElementById("app-container").classList.add("hidden");
}

// TABS DA INTERFACE
function trocarAba(aba) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));

  if (aba === "vendas") {
    document.getElementById("aba-vendas").classList.remove("hidden");
    if (event) event.target.classList.add("active");
  } else if (aba === "relatorio") {
    document.getElementById("aba-relatorio").classList.remove("hidden");
    if (event) event.target.classList.add("active");
    carregarRelatorioDiario();
  } else if (aba === "produtos") {
    document.getElementById("aba-produtos").classList.remove("hidden");
    if (event) event.target.classList.add("active");
    carregarTabelaProdutosGerente();
  }
}

// DADOS DE PRODUTOS E CATEGORIAS DINÂMICAS
async function carregarProdutos() {
  const { data, error } = await supabaseClient.from("produtos").select("*").order("nome");
  if (error) {
    alert("Erro ao carregar produtos: " + error.message);
    return;
  }
  listaProdutos = data || [];
  atualizarFiltroCategorias();
  filtrarProdutosPorCategoria();
}

// ATUALIZA OS DROPDOWNS E SUGESTÕES DE CATEGORIA DINAMICAMENTE
function atualizarFiltroCategorias() {
  const selectCat = document.getElementById("select-categoria");
  const datalistCat = document.getElementById("lista-sugestao-categorias");
  
  if (!selectCat) return;

  const categoriasUnicas = [...new Set(listaProdutos.map(p => p.categoria?.toLowerCase()).filter(Boolean))].sort();

  selectCat.innerHTML = '<option value="todas">Todas as Categorias</option>';
  if (datalistCat) datalistCat.innerHTML = "";

  categoriasUnicas.forEach(cat => {
    const nomeFormatado = cat.charAt(0).toUpperCase() + cat.slice(1);
    
    const optSelect = document.createElement("option");
    optSelect.value = cat;
    optSelect.innerText = nomeFormatado;
    selectCat.appendChild(optSelect);

    if (datalistCat) {
      const optData = document.createElement("option");
      optData.value = cat;
      datalistCat.appendChild(optData);
    }
  });
}

function filtrarProdutosPorCategoria() {
  const categoria = document.getElementById("select-categoria").value.toLowerCase();
  const selectProduto = document.getElementById("select-produto");
  selectProduto.innerHTML = '<option value="">Selecione um item...</option>';

  const filtrados = (categoria === "todas") 
    ? listaProdutos 
    : listaProdutos.filter(p => (p.categoria || "").toLowerCase() === categoria);

  filtrados.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.id;
    opt.innerText = `${prod.nome} - R$ ${parseFloat(prod.preco_unitario).toFixed(2)}`;
    opt.dataset.preco = prod.preco_unitario;
    opt.dataset.nome = prod.nome;
    opt.dataset.categoria = prod.categoria;
    selectProduto.appendChild(opt);
  });

  atualizarValores();
}

function atualizarValores() {
  const select = document.getElementById("select-produto");
  const qtd = parseInt(document.getElementById("input-qtd").value) || 1;
  const selectedOpt = select.options[select.selectedIndex];

  if (selectedOpt && selectedOpt.dataset.preco) {
    const precoUnit = parseFloat(selectedOpt.dataset.preco);
    const total = precoUnit * qtd;

    document.getElementById("valor-unitario").value = `R$ ${precoUnit.toFixed(2)}`;
    document.getElementById("valor-total").innerText = `R$ ${total.toFixed(2)}`;
  } else {
    document.getElementById("valor-unitario").value = "R$ 0,00";
    document.getElementById("valor-total").innerText = "R$ 0,00";
  }
}

// MOSTRAR/OCULTAR CHAVE PIX
function togglePixInfo() {
  const radioSelecionado = document.querySelector('input[name="forma_pagamento"]:checked');
  const boxPix = document.getElementById("box-pix");
  
  if (radioSelecionado && radioSelecionado.value === "Pix") {
    boxPix.classList.remove("hidden");
  } else {
    boxPix.classList.add("hidden");
  }
}

// MOSTRAR/OCULTAR CAMPO NOME DO CLIENTE (PAGAR DEPOIS)
function toggleNomeCliente() {
  const radioStatus = document.querySelector('input[name="status_pagamento"]:checked');
  const boxNome = document.getElementById("box-nome-cliente");
  const inputNome = document.getElementById("input-nome-cliente");

  if (radioStatus && radioStatus.value === "Pendente") {
    boxNome.classList.remove("hidden");
  } else {
    boxNome.classList.add("hidden");
    if (inputNome) inputNome.value = "";
  }
}

// REGISTRAR UMA NOVA VENDA
async function registrarVenda(e) {
  e.preventDefault();
  const select = document.getElementById("select-produto");
  const selectedOpt = select.options[select.selectedIndex];
  
  const radioPagamento = document.querySelector('input[name="forma_pagamento"]:checked');
  const formaPagamento = radioPagamento ? radioPagamento.value : null;

  const radioStatus = document.querySelector('input[name="status_pagamento"]:checked');
  const statusPagamento = radioStatus ? radioStatus.value : "Pago";
  const inputNomeEl = document.getElementById("input-nome-cliente");
  const nomeCliente = inputNomeEl ? inputNomeEl.value.trim() : "";

  if (!selectedOpt || !selectedOpt.value) {
    alert("Selecione um produto válido!");
    return;
  }

  if (!formaPagamento) {
    alert("Selecione a forma de pagamento!");
    return;
  }

  if (statusPagamento === "Pendente" && !nomeCliente) {
    alert("Por favor, digite o nome de quem vai pagar depois!");
    return;
  }

  const produtoId = selectedOpt.value;
  const nomeProduto = selectedOpt.dataset.nome;
  const categoria = selectedOpt.dataset.categoria;
  const valorUnitario = parseFloat(selectedOpt.dataset.preco);
  const quantidade = parseInt(document.getElementById("input-qtd").value);
  const valorTotal = valorUnitario * quantidade;

  const btn = document.getElementById("btn-finalizar");
  btn.disabled = true;
  btn.innerText = "Salvando...";

  const novaVenda = {
    produto_id: produtoId,
    nome_produto: nomeProduto,
    categoria: categoria,
    quantidade: quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    forma_pagamento: formaPagamento,
    status_pagamento: statusPagamento,
    nome_cliente: statusPagamento === "Pendente" ? nomeCliente : null,
    vendedor_email: perfilUsuario.nome
  };

  const { error } = await supabaseClient.from("vendas").insert([novaVenda]);

  btn.disabled = false;
  btn.innerText = "Confirmar Venda";

  if (error) {
    alert("Erro ao registrar venda: " + error.message);
  } else {
    alert("Venda realizada com sucesso!");
    document.getElementById("form-venda").reset();
    togglePixInfo();
    toggleNomeCliente();
    atualizarValores();
  }
}

/* =========================================================
   MÓDULO DE GESTÃO DE PRODUTOS E CATEGORIAS (GERENTE)
   ========================================================= */

// CARREGAR TABELA DO GERENTE
function carregarTabelaProdutosGerente() {
  const tabelaCorpo = document.getElementById("tabela-produtos-gerente-corpo");
  if (!tabelaCorpo) return;

  tabelaCorpo.innerHTML = "";

  if (listaProdutos.length === 0) {
    tabelaCorpo.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  listaProdutos.forEach(prod => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${prod.nome}</strong></td>
      <td><span class="badge-pagamento">${prod.categoria}</span></td>
      <td>R$ ${parseFloat(prod.preco_unitario).toFixed(2)}</td>
      <td style="text-align: center;">
        <button class="btn btn-sm btn-edit" onclick="prepararEdicaoProduto('${prod.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirProduto('${prod.id}')">🗑️ Excluir</button>
      </td>
    `;
    tabelaCorpo.appendChild(tr);
  });
}

// CADASTRAR OU ATUALIZAR PRODUTO
async function salvarProduto(e) {
  e.preventDefault();
  const id = document.getElementById("prod-id").value;
  const nome = document.getElementById("prod-nome").value.trim();
  const categoria = document.getElementById("prod-categoria").value.trim().toLowerCase();
  const preco = parseFloat(document.getElementById("prod-preco").value);

  if (!nome || !categoria || isNaN(preco)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const btn = document.getElementById("btn-salvar-produto");
  btn.disabled = true;
  btn.innerText = "Salvando...";

  let resError = null;

  if (id) {
    const { error } = await supabaseClient
      .from("produtos")
      .update({ nome, categoria, preco_unitario: preco })
      .eq("id", id);
    resError = error;
  } else {
    const { error } = await supabaseClient
      .from("produtos")
      .insert([{ nome, categoria, preco_unitario: preco }]);
    resError = error;
  }

  btn.disabled = false;
  btn.innerText = "Salvar Produto";

  if (resError) {
    alert("Erro ao salvar produto: " + resError.message);
  } else {
    alert(id ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
    limparFormularioProduto();
    await carregarProdutos();
    carregarTabelaProdutosGerente();
  }
}

// PREPARAR FORMULÁRIO PARA EDIÇÃO
function prepararEdicaoProduto(id) {
  const prod = listaProdutos.find(p => p.id === id);
  if (!prod) return;

  document.getElementById("prod-id").value = prod.id;
  document.getElementById("prod-nome").value = prod.nome;
  document.getElementById("prod-categoria").value = prod.categoria;
  document.getElementById("prod-preco").value = prod.preco_unitario;

  document.getElementById("titulo-form-produto").innerText = "✏️ Editar Produto";
  document.getElementById("btn-salvar-produto").innerText = "Atualizar Produto";
  document.getElementById("btn-cancelar-edicao").classList.remove("hidden");
}

// LIMPAR FORMULÁRIO DE PRODUTO
function limparFormularioProduto() {
  document.getElementById("form-produto").reset();
  document.getElementById("prod-id").value = "";
  document.getElementById("titulo-form-produto").innerText = "📦 Cadastrar / Editar Produto";
  document.getElementById("btn-salvar-produto").innerText = "Salvar Produto";
  document.getElementById("btn-cancelar-edicao").classList.add("hidden");
}

// EXCLUIR PRODUTO
async function excluirProduto(id) {
  const prod = listaProdutos.find(p => p.id === id);
  const confirmacao = confirm(`Tem certeza que deseja excluir o produto "${prod?.nome}"?`);

  if (!confirmacao) return;

  const { error } = await supabaseClient.from("produtos").delete().eq("id", id);

  if (error) {
    alert("Erro ao excluir produto: " + error.message);
  } else {
    alert("Produto excluído com sucesso!");
    await carregarProdutos();
    carregarTabelaProdutosGerente();
  }
}

// CARREGAR OPÇÕES DE VENDEDORES NO FILTRO
async function carregarOpcoesVendedores() {
  const select = document.getElementById("filtro-vendedor");
  if (!select || select.options.length > 1) return;

  const { data: perfis, error } = await supabaseClient
    .from("perfis")
    .select("nome")
    .order("nome");

  if (error || !perfis) return;

  perfis.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nome;
    opt.innerText = p.nome;
    select.appendChild(opt);
  });
}

// CARREGAR RELATÓRIO DIÁRIO
async function carregarRelatorioDiario() {
  const dataSelecionada = document.getElementById("filtro-data").value;
  const filtroVendedorEl = document.getElementById("filtro-vendedor");
  const vendedorSelecionado = filtroVendedorEl ? filtroVendedorEl.value : "todos";

  if (!dataSelecionada) return;

  await carregarOpcoesVendedores();

  const inicioDia = `${dataSelecionada}T00:00:00.000Z`;
  const fimDia = `${dataSelecionada}T23:59:59.999Z`;

  let query = supabaseClient
    .from("vendas")
    .select("*")
    .gte("data_venda", inicioDia)
    .lte("data_venda", fimDia);

  if (vendedorSelecionado && vendedorSelecionado !== "todos") {
    query = query.eq("vendedor_email", vendedorSelecionado);
  }

  const { data: vendas, error } = await query.order("data_venda", { ascending: false });

  if (error) {
    console.error("Erro ao carregar relatórios:", error);
    return;
  }

  let faturamentoTotal = 0;
  let totalItens = 0;
  const vendasPorVendedor = {};
  const vendasPorProduto = {};

  const tabelaCorpo = document.getElementById("tabela-vendas-corpo");
  tabelaCorpo.innerHTML = "";

  if (vendas.length === 0) {
    tabelaCorpo.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma venda registrada nesta data.</td></tr>';
  }

  vendas.forEach(v => {
    faturamentoTotal += parseFloat(v.valor_total);
    totalItens += v.quantidade;

    if (!vendasPorVendedor[v.vendedor_email]) {
      vendasPorVendedor[v.vendedor_email] = 0;
    }
    vendasPorVendedor[v.vendedor_email] += parseFloat(v.valor_total);

    if (!vendasPorProduto[v.nome_produto]) {
      vendasPorProduto[v.nome_produto] = { quantidade: 0, total: 0 };
    }
    vendasPorProduto[v.nome_produto].quantidade += v.quantidade;
    vendasPorProduto[v.nome_produto].total += parseFloat(v.valor_total);

    const hora = new Date(v.data_venda).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const badgeStatus = v.status_pagamento === 'Pendente' 
      ? `<span style="background: #ffebee; color: #c62828; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px;">A PAGAR (${v.nome_cliente || 'Sem nome'})</span>`
      : `<span style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px;">PAGO</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${hora}</td>
      <td>${v.nome_produto}</td>
      <td>${v.quantidade}</td>
      <td>R$ ${parseFloat(v.valor_unitario).toFixed(2)}</td>
      <td><strong>R$ ${parseFloat(v.valor_total).toFixed(2)}</strong></td>
      <td><span class="badge-pagamento">${v.forma_pagamento || 'Não informado'}</span> ${badgeStatus}</td>
      <td>${v.vendedor_email}</td>
    `;
    tabelaCorpo.appendChild(tr);
  });

  document.getElementById("kpi-faturamento").innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
  document.getElementById("kpi-itens").innerText = totalItens;
  document.getElementById("kpi-vendas").innerText = vendas.length;

  const tabelaRodape = document.getElementById("tabela-vendas-rodape");
  if (tabelaRodape) {
    if (vendas.length === 0) {
      tabelaRodape.innerHTML = "";
    } else {
      tabelaRodape.innerHTML = `
        <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #ddd;">
          <td colspan="2" style="text-align: right;">TOTAL:</td>
          <td>${totalItens} un</td>
          <td>-</td>
          <td style="color: #2e7d32;">R$ ${faturamentoTotal.toFixed(2)}</td>
          <td colspan="2"></td>
        </tr>
      `;
    }
  }

  const listaVendEl = document.getElementById("lista-vendedores");
  if (listaVendEl) {
    listaVendEl.innerHTML = "";
    if (Object.keys(vendasPorVendedor).length === 0) {
      listaVendEl.innerHTML = "<li>Nenhum registro.</li>";
    } else {
      for (const [vendedor, valor] of Object.entries(vendasPorVendedor)) {
        const li = document.createElement("li");
        li.innerHTML = `<span>👤 ${vendedor}</span> <strong>R$ ${valor.toFixed(2)}</strong>`;
        listaVendEl.appendChild(li);
      }
    }
  }

  const listaTopProdEl = document.getElementById("lista-top-produtos");
  if (listaTopProdEl) {
    listaTopProdEl.innerHTML = "";
    const produtosOrdenados = Object.entries(vendasPorProduto)
      .sort((a, b) => b[1].quantidade - a[1].quantidade)
      .slice(0, 5);

    if (produtosOrdenados.length === 0) {
      listaTopProdEl.innerHTML = "<li>Nenhum registro.</li>";
    } else {
      produtosOrdenados.forEach(([nome, dados], index) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${index + 1}º ${nome} (${dados.quantidade} un)</span> <strong>R$ ${dados.total.toFixed(2)}</strong>`;
        listaTopProdEl.appendChild(li);
      });
    }
  }
}

/* =========================================================
   PROTEÇÃO DE TELA
   ========================================================= */

document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  return false;
});

document.addEventListener("keydown", (e) => {
  if (e.keyCode === 123 || e.key === "F12") {
    e.preventDefault();
    return false;
  }

  if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.key === 'I' || e.key === 'J' || e.key === 'C')) {
    e.preventDefault();
    return false;
  }

  if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83 || e.key === 'u' || e.key === 's')) {
    e.preventDefault();
    return false;
  }
});

setInterval(() => {
  const antes = performance.now();
  debugger;
  const depois = performance.now();
  if (depois - antes > 100) {
    window.location.reload();
  }
}, 1000);
