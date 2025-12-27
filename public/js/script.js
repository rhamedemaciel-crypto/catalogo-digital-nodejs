let produtosGlobais = [];
let carrinho = [];
let produtoSelecionado = null;
let variacaoSelecionada = null;
let descontoAtual = 0;
let categoriaAtual = 'todos'; 

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    carregarCarrinhoLocal();
    atualizarContador();
    
    // Busca dinâmica enquanto digita
    const buscaInput = document.getElementById('campo-busca');
    if(buscaInput) {
        buscaInput.addEventListener('input', filtrarProdutos);
    }
});

// --- NOVO: FUNÇÃO DO MENU LATERAL (HAMBÚRGUER) ---
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.menu-overlay');
    if(sidebar && overlay) {
        sidebar.classList.toggle('aberto');
        overlay.classList.toggle('aberto');
    }
}

// 1. Carregar Produtos
async function carregarProdutos() {
    try {
        const res = await fetch('/api/produtos');
        produtosGlobais = await res.json();
        renderizarCategorias(); 
        filtrarProdutos();      
    } catch (erro) {
        console.error("Erro ao carregar:", erro);
        const lista = document.getElementById('lista-produtos');
        if(lista) lista.innerHTML = '<p style="color:white; text-align:center">Erro ao carregar loja.</p>';
    }
}

// 2. Renderizar Categorias (Agora dentro do Menu Lateral)
function renderizarCategorias() {
    const container = document.getElementById('menu-categorias');
    if(!container) return;

    const categorias = ['todos', ...new Set(produtosGlobais.map(p => p.categoria).filter(c => c))];

    container.innerHTML = '';

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerText = cat === 'todos' ? ' VER TUDO' : ' ' + cat.toUpperCase();
        btn.className = cat === categoriaAtual ? 'btn-categoria ativo' : 'btn-categoria';
        
        btn.onclick = () => {
            categoriaAtual = cat;
            renderizarCategorias(); // Atualiza cor do botão
            toggleMenu(); // Fecha o menu lateral
            filtrarProdutos();
        };
        
        container.appendChild(btn);
    });
}

// 3. Filtrar e Renderizar (CORRIGIDO PARA NÃO DAR ERRO)
function filtrarProdutos() {
    // Tenta achar a barra de pesquisa com o ID novo ou o antigo
    const buscaInput = document.getElementById('campo-busca') || document.getElementById('barra-pesquisa');
    
    // Se achou, pega o valor. Se não achou, usa vazio '' (para não travar o site)
    const termo = buscaInput ? buscaInput.value.toLowerCase() : '';

    const container = document.getElementById('lista-produtos');
    if (!container) return; // Proteção extra caso a lista não exista
    
    container.innerHTML = '';

    const filtrados = produtosGlobais.filter(produto => {
        const matchCategoria = categoriaAtual === 'todos' || produto.categoria === categoriaAtual;
        const matchNome = produto.nome.toLowerCase().includes(termo);
        const isAtivo = produto.ativo !== false;
        return matchCategoria && matchNome && isAtivo;
    });

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:20px; color:#888;">Nenhum produto encontrado.</p>';
        return;
    }

    filtrados.forEach(p => {
        const precos = p.variacoes.map(v => v.preco_venda);
        const menorPreco = precos.length > 0 ? Math.min(...precos) : 0;
        // Garante que a imagem existe ou usa uma padrão
        const imgUrl = p.imagem ? p.imagem : 'https://via.placeholder.com/150';

        const div = document.createElement('div');
        div.className = 'card';
        div.onclick = (e) => { if(e.target.tagName !== 'BUTTON') abrirModal(p.id); };
        
        div.innerHTML = `
            <img src="${imgUrl}" alt="${p.nome}" loading="lazy">
            <div class="card-info">
                <h3>${p.nome}</h3>
                <div class="preco">R$ ${menorPreco.toFixed(2)}</div>
                <button onclick="abrirModal(${p.id})">COMPRAR</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- MODAL DE PRODUTO (ATUALIZADO COM ORDENAÇÃO E VISUAL NEON) ---
function abrirModal(id) {
    produtoSelecionado = produtosGlobais.find(p => p.id === id);
    if(!produtoSelecionado) return;

    document.getElementById('modal-titulo').innerText = produtoSelecionado.nome;
    document.getElementById('modal-img').src = produtoSelecionado.imagem || 'https://via.placeholder.com/150';
    document.getElementById('modal-qtd').value = 1;
    
    // --- MUDANÇA PEDIDA: Ordenar alfabeticamente ---
    const variacoesOrdenadas = [...produtoSelecionado.variacoes].sort((a, b) => {
        return a.marca.localeCompare(b.marca);
    });

    const lista = document.getElementById('modal-opcoes');
    lista.innerHTML = '';
    
    if (variacoesOrdenadas.length === 0) {
        lista.innerHTML = '<p style="color:red">Indisponível</p>';
        return;
    }

    // Seleciona o primeiro automaticamente
    selVar(variacoesOrdenadas[0], 0);

    variacoesOrdenadas.forEach((v, idx) => {
        const div = document.createElement('div');
        div.className = 'opcao-item';
        div.id = `var-btn-${idx}`;
        
        const semEstoque = v.estoque <= 0;
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <strong>${v.marca}</strong>
                <span>R$ ${v.preco_venda.toFixed(2)}</span>
            </div>
            ${semEstoque ? '<small style="color:red">(Esgotado)</small>' : ''}
        `;

        if (!semEstoque) {
            div.onclick = () => selVar(v, idx);
        } else {
            div.style.opacity = '0.5';
        }
        
        lista.appendChild(div);
    });

    document.getElementById('modal-produto').style.display = 'flex';
}

function selVar(variacao, idx) {
    variacaoSelecionada = variacao;
    document.getElementById('modal-preco').innerText = "R$ " + variacao.preco_venda.toFixed(2);
    
    // Visual de seleção (Borda Neon)
    const todos = document.querySelectorAll('.opcao-item');
    todos.forEach(el => { el.style.borderColor = '#333'; el.style.color = '#ccc'; });
    
    const atual = document.getElementById(`var-btn-${idx}`);
    if(atual) {
        atual.style.borderColor = '#ff5e00';
        atual.style.color = 'white';
    }
}

// --- CARRINHO (MANTIDA SUA LÓGICA DE CUPONS E ZAP) ---

function adicionarAoCarrinhoModal() {
    if(!variacaoSelecionada) return alert("Selecione uma opção!");
    const qtd = parseInt(document.getElementById('modal-qtd').value) || 1;

    if(qtd > variacaoSelecionada.estoque) return alert(`Apenas ${variacaoSelecionada.estoque} unidades disponíveis!`);

    carrinho.push({
        produto: produtoSelecionado.nome,
        marca: variacaoSelecionada.marca,
        preco: variacaoSelecionada.preco_venda,
        qtd: qtd,
        total: variacaoSelecionada.preco_venda * qtd
    });

    salvarCarrinho();
    atualizarContador();
    fecharModal('modal-produto');
    
    // Animaçãozinha no botão
    const btn = document.querySelector('.botao-flutuante');
    if(btn) { btn.style.transform = 'scale(1.2)'; setTimeout(()=>btn.style.transform='scale(1)', 200);}
}

function abrirCarrinho() {
    const lista = document.getElementById('itens-carrinho');
    lista.innerHTML = '';
    let total = 0;

    carrinho.forEach((item, idx) => {
        total += item.preco * item.qtd; // Recalcula baseado no unitário para segurança
        item.total = item.preco * item.qtd; // Atualiza objeto
        
        lista.innerHTML += `
            <div class="item-carrinho" style="border-bottom:1px solid #333; padding:10px; color:white;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${item.qtd}x ${item.produto}</strong>
                    <span style="color:#ff5e00">R$ ${item.total.toFixed(2)}</span>
                </div>
                <div style="font-size:0.8em; color:#ccc;">${item.marca}</div>
                <button onclick="rmItem(${idx})" style="color:red; background:none; border:none; margin-top:5px; cursor:pointer;">Remover 🗑️</button>
            </div>`;
    });

    let totalFinal = total;
    let htmlTotal = `Total: R$ ${total.toFixed(2)}`;

    if(descontoAtual > 0) {
        totalFinal = total * (1 - descontoAtual/100);
        htmlTotal = `
            <span style="text-decoration: line-through; font-size: 0.8em; color: #999;">R$ ${total.toFixed(2)}</span><br>
            <span style="color:#00ff88; font-size:1.2em;">R$ ${totalFinal.toFixed(2)}</span> 
            <small>(${descontoAtual}% OFF)</small>
        `;
    }

    document.getElementById('total-carrinho').innerHTML = htmlTotal;
    document.getElementById('modal-carrinho').style.display = 'flex';
}

function rmItem(idx) {
    carrinho.splice(idx, 1);
    salvarCarrinho();
    atualizarContador();
    abrirCarrinho();
}

async function aplicarCupom() {
    const cod = document.getElementById('cupom-codigo').value; // ID ajustado para o novo HTML
    
    try {
        const res = await fetch(`/api/cupom/${cod}`);
        const data = await res.json();

        if(data.valido) {
            descontoAtual = data.desconto;
            alert(`Desconto de ${data.desconto}% aplicado!`);
            abrirCarrinho();
        } else {
            descontoAtual = 0;
            alert("Cupom inválido");
            abrirCarrinho();
        }
    } catch(e) { console.error(e); }
}

// SUA FUNÇÃO ORIGINAL DE ZAP (PRESERVADA)
async function finalizarCompra() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    const nome = document.getElementById('nome-cliente').value;
    if(!nome) return alert("Digite seu nome!");

    // Recalcula totais
    let totalBruto = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    let totalFinal = totalBruto * (1 - descontoAtual/100);

    const pedidoParaSalvar = {
        cliente: nome,
        itens: carrinho,
        total: totalFinal
    };

    try {
        const resposta = await fetch('/api/venda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoParaSalvar)
        });

        if (resposta.ok) {
            // MENSAGEM WHATSAPP
            let msg = `*NOVO PEDIDO - TROPA DO BRUXO* \n\n`;
            msg += `*Cliente:* ${nome}\n`;
            msg += `---------------------------\n`;
            carrinho.forEach(item => {
                msg += `${item.qtd}x ${item.produto} (${item.marca}): R$ ${(item.preco * item.qtd).toFixed(2)}\n`;
            });
            msg += `---------------------------\n`;

            if(descontoAtual > 0) {
                msg += `Subtotal: R$ ${totalBruto.toFixed(2)}\n`;
                msg += `Desconto: ${descontoAtual}%\n`;
                msg += `*TOTAL: R$ ${totalFinal.toFixed(2)}*\n\n`;
            } else {
                msg += `*TOTAL: R$ ${totalBruto.toFixed(2)}*\n\n`;
            }
            
            msg += `Aguardo a chave PIX!`;

            // Número do seu cliente fixo aqui
            const tel = "5583993290977"; 
            
            carrinho = [];
            descontoAtual = 0;
            salvarCarrinho();
            atualizarContador();
            fecharModal('modal-carrinho');

            window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            alert("Erro ao processar pedido. Tente novamente.");
        }
    } catch (erro) {
        console.error(erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Helpers
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }
function salvarCarrinho() { localStorage.setItem('carrinho_tropa', JSON.stringify(carrinho)); }
function carregarCarrinhoLocal() { const d = localStorage.getItem('carrinho_tropa'); if(d) carrinho = JSON.parse(d); }
function atualizarContador() { 
    const contador = document.getElementById('contador-carrinho');
    if(contador) contador.innerText = carrinho.length; 
}