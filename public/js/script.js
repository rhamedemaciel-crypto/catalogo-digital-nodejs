let produtosGlobais = [];
let carrinho = [];
let produtoSelecionado = null;
let variacaoSelecionada = null;
let descontoAtual = 0;
let categoriaAtual = 'todos'; // Estado inicial

// 1. Carregar Produtos e Configurar Filtros
async function carregarProdutos() {
    try {
        const res = await fetch('/api/produtos');
        produtosGlobais = await res.json();
        
        renderizarCategorias(); // Cria os botões
        filtrarProdutos();      // Mostra tudo inicial
    } catch (erro) {
        console.error("Erro ao carregar:", erro);
        document.getElementById('lista-produtos').innerHTML = '<p>Erro ao carregar loja.</p>';
    }
}

// 2. Extrair Categorias Únicas e Criar Botões
function renderizarCategorias() {
    const container = document.getElementById('menu-categorias');
    // Set remove duplicatas automaticamente
    const categorias = ['todos', ...new Set(produtosGlobais.map(p => p.categoria).filter(c => c))];

    container.innerHTML = '';

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        // Deixa a primeira letra maiúscula (ex: bebida -> Bebida)
        btn.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.className = cat === 'todos' ? 'btn-categoria ativo' : 'btn-categoria';
        
        btn.onclick = () => {
            categoriaAtual = cat;
            // Muda a cor dos botões
            document.querySelectorAll('.btn-categoria').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtrarProdutos();
        };
        
        container.appendChild(btn);
    });
}

// 3. Lógica de Filtragem (Pesquisa + Categoria)
function filtrarProdutos() {
    const termo = document.getElementById('barra-pesquisa').value.toLowerCase();
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '';

    const filtrados = produtosGlobais.filter(produto => {
        const matchCategoria = categoriaAtual === 'todos' || produto.categoria === categoriaAtual;
        const matchNome = produto.nome.toLowerCase().includes(termo);
        return matchCategoria && matchNome;
    });

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#666; margin-top:20px;">Nenhum produto encontrado.</p>';
        return;
    }

    // Desenha os produtos filtrados
    filtrados.forEach(p => {
        let preco = p.variacoes.length > 0 ? Math.min(...p.variacoes.map(v => v.preco_venda)) : 0;
        
        // Verifica se tem imagem, senão usa placeholder
        let img = p.imagem ? p.imagem : 'https://via.placeholder.com/150?text=Sem+Foto';

        container.innerHTML += `
            <div class="card">
                <img src="${img}" loading="lazy">
                <div class="card-info">
                    <h3>${p.nome}</h3>
                    <small style="color:#888">${p.categoria || 'Geral'}</small>
                    <p class="preco">A partir de R$ ${preco.toFixed(2)}</p>
                    <button onclick="abrirModal(${p.id})">Comprar</button>
                </div>
            </div>`;
    });
}

// --- FUNÇÕES DO CARRINHO (IGUAIS AO ANTERIOR) ---

function abrirModal(id) {
    produtoSelecionado = produtosGlobais.find(p => p.id === id);
    document.getElementById('modal-titulo').innerText = produtoSelecionado.nome;
    document.getElementById('modal-img').src = produtoSelecionado.imagem || 'https://via.placeholder.com/150';
    document.getElementById('qtd-produto').value = 1;
    
    const lista = document.getElementById('lista-variacoes');
    lista.innerHTML = '';
    variacaoSelecionada = null;
    document.getElementById('preco-total').innerText = "R$ 0,00";

    produtoSelecionado.variacoes.forEach((v, idx) => {
        const semEstoque = v.estoque <= 0;
        lista.innerHTML += `
            <label class="opcao-item" style="${semEstoque ? 'opacity:0.5' : ''}">
                <input type="radio" name="opcao" onchange="selVar(${idx})" ${semEstoque ? 'disabled' : ''}>
                ${v.marca} - R$ ${v.preco_venda.toFixed(2)} ${semEstoque ? '(Esgotado)' : ''}
            </label>`;
    });
    document.getElementById('modal-compra').style.display = 'flex';
}

function selVar(idx) {
    variacaoSelecionada = produtoSelecionado.variacoes[idx];
    atualizarTotalModal();
}

// Ouve mudanças na quantidade para recalcular o total do modal na hora
document.getElementById('qtd-produto').addEventListener('input', atualizarTotalModal);

function atualizarTotalModal() {
    if(!variacaoSelecionada) return;
    let qtd = parseInt(document.getElementById('qtd-produto').value) || 1;
    let total = variacaoSelecionada.preco_venda * qtd;
    document.getElementById('preco-total').innerText = "R$ " + total.toFixed(2);
}

function adicionarAoCarrinho() {
    if(!variacaoSelecionada) return alert("Selecione uma opção!");
    const qtd = parseInt(document.getElementById('qtd-produto').value) || 1;

    if(qtd > variacaoSelecionada.estoque) return alert(`Apenas ${variacaoSelecionada.estoque} unidades disponíveis!`);

    carrinho.push({
        produto: produtoSelecionado.nome,
        marca: variacaoSelecionada.marca,
        preco: variacaoSelecionada.preco_venda,
        qtd: qtd,
        total: variacaoSelecionada.preco_venda * qtd
    });

    fecharModal();
    atualizarContador();
    alert("Adicionado ao carrinho!");
}

function atualizarContador() {
    document.getElementById('contador-carrinho').innerText = carrinho.length;
    document.getElementById('btn-carrinho').style.display = carrinho.length > 0 ? 'flex' : 'none';
}

function abrirCarrinho() {
    const lista = document.getElementById('itens-carrinho');
    lista.innerHTML = '';
    let total = 0;

    carrinho.forEach((item, idx) => {
        total += item.total;
        lista.innerHTML += `
            <div class="item-carrinho">
                <div><strong>${item.qtd}x</strong> ${item.produto} (${item.marca})</div>
                <div>R$ ${item.total.toFixed(2)} <span class="btn-lixeira" onclick="rmItem(${idx})">🗑️</span></div>
            </div>`;
    });

    let totalFinal = total;
    if(descontoAtual > 0) {
        totalFinal = total * (1 - descontoAtual/100);
        document.getElementById('total-carrinho').innerHTML = `
            <span style="text-decoration: line-through; font-size: 14px; color: #999;">R$ ${total.toFixed(2)}</span><br>
            R$ ${totalFinal.toFixed(2)} <span style="color:green; font-size:14px">(${descontoAtual}% OFF)</span>
        `;
    } else {
        document.getElementById('total-carrinho').innerText = "R$ " + totalFinal.toFixed(2);
    }
    
    document.getElementById('modal-carrinho').style.display = 'flex';
}

function rmItem(idx) {
    carrinho.splice(idx, 1);
    atualizarContador();
    abrirCarrinho();
}

async function aplicarCupom() {
    const cod = document.getElementById('input-cupom').value;
    const msg = document.getElementById('msg-cupom');
    
    try {
        const res = await fetch(`/api/cupom/${cod}`);
        const data = await res.json();

        if(data.valido) {
            descontoAtual = data.desconto;
            msg.style.color = 'green';
            msg.innerText = `Desconto de ${data.desconto}% aplicado!`;
            abrirCarrinho();
        } else {
            descontoAtual = 0;
            msg.style.color = 'red';
            msg.innerText = "Cupom inválido";
            abrirCarrinho();
        }
    } catch(e) { console.error(e); }
}

function enviarPedidoZap(tel) {
    if(carrinho.length === 0) return;
    
    // Calcula totais
    let totalBruto = carrinho.reduce((acc, item) => acc + item.total, 0);
    let totalLiquido = totalBruto * (1 - descontoAtual/100);

    let msg = `*NOVO PEDIDO DO SITE!* 🛒%0A%0A`;
    
    carrinho.forEach(item => {
        msg += `- ${item.qtd}x ${item.produto} (${item.marca}): R$ ${item.total.toFixed(2)}%0A`;
    });

    msg += `%0A--------------------------------`;
    if(descontoAtual > 0) {
        msg += `%0ASubtotal: R$ ${totalBruto.toFixed(2)}`;
        msg += `%0ADesconto: ${descontoAtual}%`;
        msg += `%0A*TOTAL A PAGAR: R$ ${totalLiquido.toFixed(2)}*`;
    } else {
        msg += `%0A*TOTAL A PAGAR: R$ ${totalBruto.toFixed(2)}*`;
    }
    
    // URL para Baixa de Estoque (Fase 2 - Futuro)
    // msg += `%0A%0AAdmin: Clique para confirmar baixa: seudesite.com/baixa...`;

    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
}

function fecharModal() { document.getElementById('modal-compra').style.display = 'none'; }
function fecharCarrinho() { document.getElementById('modal-carrinho').style.display = 'none'; }

// Iniciar
carregarProdutos();