/* --- VARIÁVEIS GLOBAIS --- */
let produtosGlobais = [];
let carrinho = [];
let produtoSelecionado = null;
let variacaoSelecionada = null;
let descontoAtual = 0;
let categoriaAtual = 'todos'; 
let configLoja = {}; // Guardará as configurações (Cores, Links, Tel)

/* --- INICIALIZAÇÃO (Ao carregar a página) --- */
document.addEventListener('DOMContentLoaded', () => {
    carregarTema();      // 1. Aplica as cores, imagens e LINKS
    carregarProdutos();  // 2. Busca e exibe os produtos
    carregarCarrinhoLocal();
    atualizarContador();
    
    // Configura a busca dinâmica enquanto digita
    const buscaInput = document.getElementById('campo-busca');
    if(buscaInput) {
        buscaInput.addEventListener('input', filtrarProdutos);
    }
});

/* --- SISTEMA DE TEMAS E CONFIGURAÇÕES --- */
async function carregarTema() {
    try {
        const response = await fetch('/config');
        if (!response.ok) throw new Error('Falha ao carregar config');
        
        const tema = await response.json();
        configLoja = tema; // Salva na memória global para usar no checkout

        // 1. Aplica a Cor Neon
        if (tema.corDestaque) {
            document.documentElement.style.setProperty('--neon-orange', tema.corDestaque);
        }

        // 2. Aplica o Fundo do Site
        if (tema.fundoSite) {
            document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.92), rgba(0,0,0,0.98)), url('../uploads/${tema.fundoSite}')`;
        }

        // 3. Aplica o Fundo do Header
        if (tema.fundoHeader) {
            const header = document.querySelector('header');
            if (header) {
                header.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('../uploads/${tema.fundoHeader}')`;
            }
        }

        // 4. Atualiza o Título
        if (tema.nomeLoja) {
            const titulo = document.querySelector('header h1');
            if (titulo) titulo.innerText = tema.nomeLoja;
            document.title = tema.nomeLoja + " | Loja Oficial";
        }

        // 5. ATUALIZA REDES SOCIAIS (NOVO)
        if (tema.instagramLink) {
            const btnInsta = document.getElementById('link-insta');
            if(btnInsta) btnInsta.href = tema.instagramLink;
        }

        if (tema.whatsappFlutuante) {
            const btnWhats = document.getElementById('link-whats-float');
            // Link genérico para dúvidas
            if(btnWhats) btnWhats.href = `https://wa.me/${tema.whatsappFlutuante}?text=Olá, vim pelo site e tenho uma dúvida.`;
        }

    } catch (error) {
        console.log("Usando configurações padrão.");
    }
}

/* --- MENU LATERAL (HAMBÚRGUER) --- */
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.menu-overlay');
    
    if(sidebar && overlay) {
        sidebar.classList.toggle('aberto');
        overlay.classList.toggle('aberto');
    }
}

/* --- LÓGICA DE PRODUTOS --- */

async function carregarProdutos() {
    try {
        const res = await fetch('/api/produtos');
        produtosGlobais = await res.json();
        
        renderizarCategorias(); 
        filtrarProdutos();      
    } catch (erro) {
        console.error("Erro ao carregar:", erro);
        const lista = document.getElementById('lista-produtos');
        if(lista) lista.innerHTML = '<p style="color:white; text-align:center; padding: 20px;">Erro ao carregar loja. Verifique a conexão.</p>';
    }
}

function renderizarCategorias() {
    const container = document.getElementById('menu-categorias');
    if(!container) return;

    const categorias = ['todos', ...new Set(produtosGlobais.map(p => p.categoria).filter(c => c))];

    container.innerHTML = '';

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerText = cat === 'todos' ? '🔥 VER TUDO' : '👉 ' + cat.toUpperCase();
        btn.className = cat === categoriaAtual ? 'btn-categoria ativo' : 'btn-categoria';
        
        btn.onclick = () => {
            categoriaAtual = cat;
            renderizarCategorias(); 
            toggleMenu();           
            filtrarProdutos();      
        };
        
        container.appendChild(btn);
    });
}

function filtrarProdutos() {
    const buscaInput = document.getElementById('campo-busca');
    const termo = buscaInput ? buscaInput.value.toLowerCase() : '';

    const container = document.getElementById('lista-produtos');
    if (!container) return;
    
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

/* --- MODAL DE DETALHES --- */
function abrirModal(id) {
    produtoSelecionado = produtosGlobais.find(p => p.id === id);
    if(!produtoSelecionado) return;

    document.getElementById('modal-titulo').innerText = produtoSelecionado.nome;
    document.getElementById('modal-img').src = produtoSelecionado.imagem || 'https://via.placeholder.com/150';
    document.getElementById('modal-qtd').value = 1;
    
    const variacoesOrdenadas = [...produtoSelecionado.variacoes].sort((a, b) => {
        return a.marca.localeCompare(b.marca);
    });

    const lista = document.getElementById('modal-opcoes');
    lista.innerHTML = '';
    
    if (variacoesOrdenadas.length === 0) {
        lista.innerHTML = '<p style="color:red">Produto indisponível no momento.</p>';
        return;
    }

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
            ${semEstoque ? '<small style="color:red; font-size:0.7em">(Esgotado)</small>' : ''}
        `;

        if (!semEstoque) {
            div.onclick = () => selVar(v, idx);
        } else {
            div.style.opacity = '0.5';
            div.style.cursor = 'not-allowed';
        }
        
        lista.appendChild(div);
    });

    document.getElementById('modal-produto').style.display = 'flex';
}

function selVar(variacao, idx) {
    variacaoSelecionada = variacao;
    document.getElementById('modal-preco').innerText = "R$ " + variacao.preco_venda.toFixed(2);
    
    const todos = document.querySelectorAll('.opcao-item');
    todos.forEach(el => { 
        el.style.borderColor = '#333'; 
        el.style.color = '#ccc'; 
        el.style.background = '#1a1a1a';
    });
    
    const atual = document.getElementById(`var-btn-${idx}`);
    if(atual) {
        atual.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--neon-orange');
        atual.style.color = 'white';
        atual.style.background = '#333';
    }
}

function adicionarAoCarrinhoModal() {
    if(!variacaoSelecionada) return alert("Selecione uma opção!");
    
    const qtd = parseInt(document.getElementById('modal-qtd').value) || 1;

    if(qtd > variacaoSelecionada.estoque) {
        return alert(`Apenas ${variacaoSelecionada.estoque} unidades disponíveis!`);
    }

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
    
    const btn = document.querySelector('.botao-flutuante');
    if(btn) { 
        btn.style.transform = 'scale(1.2)'; 
        setTimeout(()=> btn.style.transform='scale(1)', 200);
    }
}

/* --- CARRINHO E CHECKOUT --- */

function abrirCarrinho() {
    const lista = document.getElementById('itens-carrinho');
    lista.innerHTML = '';
    let total = 0;

    if(carrinho.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Seu carrinho está vazio.</p>';
    }

    carrinho.forEach((item, idx) => {
        total += item.preco * item.qtd;
        item.total = item.preco * item.qtd;
        
        lista.innerHTML += `
            <div class="item-carrinho" style="border-bottom:1px solid #333; padding:10px; color:white;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${item.qtd}x ${item.produto}</strong><br>
                        <small style="color:#ccc;">${item.marca}</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:var(--neon-orange); font-weight:bold;">R$ ${item.total.toFixed(2)}</span><br>
                        <button onclick="rmItem(${idx})" style="color:#ff4444; background:none; border:none; cursor:pointer; font-size:0.8em; margin-top:5px;">Excluir</button>
                    </div>
                </div>
            </div>`;
    });

    let totalFinal = total;
    let htmlTotal = `Total: R$ ${total.toFixed(2)}`;

    if(descontoAtual > 0) {
        totalFinal = total * (1 - descontoAtual/100);
        htmlTotal = `
            <span style="text-decoration: line-through; font-size: 0.8em; color: #999;">R$ ${total.toFixed(2)}</span><br>
            <span style="color:#00ff88; font-size:1.2em; font-weight:bold;">R$ ${totalFinal.toFixed(2)}</span> 
            <small style="color:#00ff88">(${descontoAtual}% OFF)</small>
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
    const codInput = document.getElementById('cupom-codigo');
    const cod = codInput ? codInput.value.trim() : '';
    
    if(!cod) return alert("Digite um código de cupom.");

    try {
        const res = await fetch(`/api/cupom/${cod}`);
        const data = await res.json();

        if(data.valido) {
            descontoAtual = data.desconto;
            alert(`Sucesso! Desconto de ${data.desconto}% aplicado.`);
            abrirCarrinho();
        } else {
            descontoAtual = 0;
            alert("Cupom inválido ou expirado.");
            abrirCarrinho();
        }
    } catch(e) { 
        console.error(e);
        alert("Erro ao validar cupom.");
    }
}

/* --- FINALIZAR COMPRA (ATUALIZADO COM NÚMERO DO ADMIN) --- */
async function finalizarCompra() {
    if(carrinho.length === 0) return alert("Seu carrinho está vazio!");
    
    const nomeInput = document.getElementById('nome-cliente');
    const nome = nomeInput ? nomeInput.value.trim() : '';
    
    if(!nome) {
        alert("Por favor, digite seu nome para identificarmos o pedido.");
        nomeInput.focus();
        return;
    }

    // Cálculos
    let totalBruto = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    let totalFinal = totalBruto * (1 - descontoAtual/100);

    // Salvar Venda
    const pedidoParaSalvar = {
        cliente: nome,
        itens: carrinho,
        total: totalFinal,
        data: new Date().toISOString()
    };

    try {
        await fetch('/api/venda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoParaSalvar)
        });

        // Montar Mensagem WhatsApp
        let msg = `*NOVO PEDIDO - ${configLoja.nomeLoja || 'TROPA DO BRUXO'}* 🧙‍♂️\n\n`;
        msg += `*Cliente:* ${nome}\n`;
        msg += `------------------------------\n`;
        
        carrinho.forEach(item => {
            msg += `📦 ${item.qtd}x ${item.produto}\n`;
            msg += `   Opção: ${item.marca}\n`;
            msg += `   Valor: R$ ${(item.preco * item.qtd).toFixed(2)}\n`;
        });
        
        msg += `------------------------------\n`;

        if(descontoAtual > 0) {
            msg += `Subtotal: R$ ${totalBruto.toFixed(2)}\n`;
            msg += `Desconto: -${descontoAtual}%\n`;
            msg += `*TOTAL A PAGAR: R$ ${totalFinal.toFixed(2)}* ✅\n\n`;
        } else {
            msg += `*TOTAL A PAGAR: R$ ${totalBruto.toFixed(2)}* ✅\n\n`;
        }
        
        msg += `Aguardo a chave PIX para pagamento!`;

        // 3. Redireciona para o WhatsApp configurado no Admin
        // Se não tiver configurado, usa um número padrão
        const tel = configLoja.whatsappPedidos || "5583999999999"; 
        
        // Limpa tudo
        carrinho = [];
        descontoAtual = 0;
        salvarCarrinho();
        atualizarContador();
        fecharModal('modal-carrinho');
        if(nomeInput) nomeInput.value = '';

        // Abre WhatsApp
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');

    } catch (erro) {
        console.error(erro);
        alert("Erro ao processar pedido. Tente novamente.");
    }
}

/* --- FUNÇÕES AUXILIARES --- */
function fecharModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

function salvarCarrinho() { 
    localStorage.setItem('carrinho_tropa', JSON.stringify(carrinho)); 
}

function carregarCarrinhoLocal() { 
    const d = localStorage.getItem('carrinho_tropa'); 
    if(d) carrinho = JSON.parse(d); 
}

function atualizarContador() { 
    const contador = document.getElementById('contador-carrinho');
    const qtdTotal = carrinho.reduce((acc, item) => acc + item.qtd, 0);
    if(contador) contador.innerText = qtdTotal; 
}