// ==========================================
// 0. INICIALIZAÇÃO & NAVEGAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Carrega todas as seções iniciais
    carregarDashboard(); 
    adicionarLinhaVariacao(); 
    carregarListaAdmin();
    carregarCupons();
    carregarVendas();
    carregarConfiguracoesNoForm();
    
    // Listeners de Formulários de Configuração
    const formTema = document.getElementById('form-tema');
    if (formTema) formTema.addEventListener('submit', salvarConfigGeneric);

    const formSocial = document.getElementById('form-social');
    if (formSocial) formSocial.addEventListener('submit', salvarConfigGeneric);
});

// Funções de Menu (Globais para o HTML acessar)
window.toggleAdminMenu = function() {
    const sidebar = document.getElementById('sidebarAdmin');
    const overlay = document.getElementById('overlayAdmin');
    if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('aberto')) {
            sidebar.classList.remove('aberto');
            overlay.classList.remove('aberto');
        } else {
            sidebar.classList.add('aberto');
            overlay.classList.add('aberto');
        }
    }
};

window.mostrarAba = function(aba) {
    // 1. Esconde todas as abas
    ['dashboard', 'pedidos', 'produtos', 'config', 'social'].forEach(id => {
        const el = document.getElementById('aba-' + id);
        if(el) el.style.display = 'none';
        
        const btn = document.getElementById('nav-' + id);
        if(btn) btn.classList.remove('ativo');
    });

    // 2. Mostra a aba selecionada
    const abaAlvo = document.getElementById('aba-' + aba);
    if(abaAlvo) abaAlvo.style.display = 'block';
    
    const btnAlvo = document.getElementById('nav-' + aba);
    if(btnAlvo) btnAlvo.classList.add('ativo');

    // 3. Recarrega dados específicos (Garante que está atualizado)
    if (aba === 'dashboard') carregarDashboard();
    if (aba === 'pedidos') carregarVendas();
    if (aba === 'produtos') carregarListaAdmin();
    if (aba === 'config' || aba === 'social') carregarConfiguracoesNoForm();
};

window.logout = function() {
    window.location.href = '/login.html';
};

// ==========================================
// 1. DASHBOARD (GRÁFICOS E KPI) - NOVO
// ==========================================
let chartInstance = null; 

async function carregarDashboard() {
    try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();

        // Preenche Cards do Topo (Se existirem na tela)
        if(document.getElementById('dash-faturamento')) {
            document.getElementById('dash-faturamento').innerText = `R$ ${data.faturamentoHoje.toFixed(2)}`;
            document.getElementById('dash-pendentes').innerText = data.pendentes;
            document.getElementById('dash-ticket').innerText = `R$ ${data.ticketMedio.toFixed(2)}`;
        }

        // Renderiza Gráfico
        renderizarGrafico(data.grafico.labels, data.grafico.valores);

        // Alerta de Estoque Baixo
        const divEstoque = document.getElementById('card-estoque-baixo');
        const listaEstoque = document.getElementById('lista-estoque-baixo');
        
        if (divEstoque && listaEstoque) {
            if (data.estoqueBaixo.length > 0) {
                divEstoque.style.display = 'block';
                listaEstoque.innerHTML = '';
                data.estoqueBaixo.forEach(item => {
                    listaEstoque.innerHTML += `
                        <div style="background:#330000; color:#ffaaaa; padding:10px; margin-bottom:5px; border-left:3px solid red; border-radius:4px;">
                            <b>${item.nome}</b> (${item.marca}) — Restam: <b>${item.estoque}</b>
                        </div>
                    `;
                });
            } else {
                divEstoque.style.display = 'none';
            }
        }

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function renderizarGrafico(labels, valores) {
    const ctxElement = document.getElementById('graficoVendas');
    if(!ctxElement) return;
    
    const ctx = ctxElement.getContext('2d');
    
    // Se já existe um gráfico, destrói para criar o novo
    if (chartInstance) chartInstance.destroy();

    // Formata datas YYYY-MM-DD para DD/MM
    const labelsFormatadas = labels.map(dataIso => {
        const parts = dataIso.split('-');
        return `${parts[2]}/${parts[1]}`;
    });

    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labelsFormatadas,
            datasets: [{
                label: 'Vendas (R$)',
                data: valores,
                borderColor: '#ff5e00', // Laranja Neon
                backgroundColor: 'rgba(255, 94, 0, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4 // Curva suave
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, 
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

// ==========================================
// 2. GESTÃO DE PRODUTOS (SUA LÓGICA MANTIDA)
// ==========================================

// Adiciona linha de variação (Global)
window.adicionarLinhaVariacao = function(dados = {}) {
    const container = document.getElementById('container-variacoes');
    const div = document.createElement('div');
    div.className = 'variacao-row'; 

    div.innerHTML = `
        <div class="form-group" style="margin-bottom:5px;">
            <input type="text" placeholder="Opção (Ex: G, 42, Azul)" class="var-marca" value="${dados.marca || ''}" required>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <input type="number" placeholder="Preço R$" class="var-preco" value="${dados.preco_venda || ''}" step="0.01" required>
            </div>
            <div style="flex:1;">
                <input type="number" placeholder="Qtd" class="var-estoque" value="${dados.estoque || ''}" required>
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">
            <i class="fas fa-trash"></i> REMOVER
        </button>
    `;
    container.appendChild(div);
};

// Preparar Edição (Global)
window.prepararEdicao = function(id) {
    const produto = window.todosProdutos.find(p => p.id === id);
    if(produto) {
        iniciarEdicao(produto);
        mostrarAba('produtos');
    }
};

function iniciarEdicao(produto) {
    document.getElementById('id-produto-editando').value = produto.id;
    document.querySelector('input[name="nome"]').value = produto.nome;
    document.querySelector('input[name="categoria"]').value = produto.categoria;
    
    document.getElementById('container-variacoes').innerHTML = '';
    if (produto.variacoes && produto.variacoes.length > 0) {
        produto.variacoes.forEach(v => adicionarLinhaVariacao(v));
    } else {
        adicionarLinhaVariacao();
    }

    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.innerText = "🔄 ATUALIZAR PRODUTO";
    btnSubmit.style.background = "linear-gradient(45deg, #9d00ff, #7a00cc)"; 
    document.getElementById('btn-cancelar').style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancelar Edição (Global)
window.cancelarEdicao = function() {
    document.getElementById('form-produto').reset();
    document.getElementById('id-produto-editando').value = '';
    document.getElementById('container-variacoes').innerHTML = '';
    adicionarLinhaVariacao(); 
    
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.innerText = "💾 SALVAR PRODUTO";
    btnSubmit.style.background = ""; 
    document.getElementById('btn-cancelar').style.display = 'none';
};

// Listener do Formulário de Produtos (Salvar/Atualizar)
const formProduto = document.getElementById('form-produto');
if(formProduto) {
    formProduto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData();
        const idEdicao = document.getElementById('id-produto-editando').value;

        formData.append('nome', form.nome.value);
        formData.append('categoria', form.categoria.value);
        if(form.imagem.files[0]) formData.append('imagem', form.imagem.files[0]);

        const variacoes = [];
        document.querySelectorAll('.variacao-row').forEach(linha => {
            variacoes.push({
                marca: linha.querySelector('.var-marca').value,
                preco_venda: parseFloat(linha.querySelector('.var-preco').value) || 0,
                estoque: parseInt(linha.querySelector('.var-estoque').value) || 0
            });
        });

        formData.append('variacoes', JSON.stringify(variacoes));

        try {
            let url = '/api/produtos';
            let method = 'POST';
            if(idEdicao) {
                url = `/api/produtos/${idEdicao}`;
                method = 'PUT';
            }

            const res = await fetch(url, { method: method, body: formData });
            if (res.ok) {
                alert(idEdicao ? "✅ Produto atualizado!" : "✅ Produto criado!");
                cancelarEdicao();
                carregarListaAdmin();
                carregarDashboard(); // Atualiza dashboard pois estoque mudou
            } else { alert("Erro ao salvar."); }
        } catch (error) { console.error(error); }
    });
}

// Deletar Produto (Global)
window.deletarProduto = async function(id) {
    if(confirm("Tem certeza que deseja excluir?")) {
        await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
        carregarListaAdmin();
        carregarDashboard();
    }
};

// Listar Produtos
async function carregarListaAdmin() {
    const container = document.getElementById('lista-produtos-admin');
    if(!container) return;
    
    try {
        const res = await fetch('/api/produtos');
        const produtos = await res.json();
        container.innerHTML = '';
        window.todosProdutos = produtos; 

        produtos.forEach(p => {
            let htmlVars = '<div style="margin-top:10px; font-size:13px; color:#aaa;">';
            if(p.variacoes){
                p.variacoes.forEach((v) => {
                    htmlVars += `
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:4px 0;">
                            <span>${v.marca} (Est: <b style="color:${v.estoque < 5 ? 'red' : '#fff'}">${v.estoque}</b>) - R$ ${v.preco_venda}</span>
                        </div>`;
                });
            }
            htmlVars += '</div>';

            const item = document.createElement('div');
            item.className = 'item-lista';
            item.style.display = 'block'; 
            item.innerHTML = `
                <div style="width:100%; padding: 5px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <img src="${p.imagem || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid #444;">
                            <div><strong style="color:#fff; font-size:1.1em;">${p.nome}</strong><br><small style="color:#888">${p.categoria}</small></div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick='prepararEdicao(${p.id})' style="background:transparent; color:#ffd700; border:1px solid #ffd700; padding:5px 10px; border-radius:5px;">✏️</button>
                            <button onclick="deletarProduto(${p.id})" style="background:transparent; color:#ff4444; border:1px solid #ff4444; padding:5px 10px; border-radius:5px;">🗑️</button>
                        </div>
                    </div>
                    ${htmlVars}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// 3. GESTÃO DE CUPONS
// ==========================================
async function carregarCupons() {
    const container = document.getElementById('lista-cupons');
    if(!container) return;
    try {
        const res = await fetch('/api/cupons');
        const cupons = await res.json();
        container.innerHTML = '';
        cupons.forEach(c => {
            container.innerHTML += `
                <div class="card-item" style="padding:15px; margin-bottom:10px; border:1px solid #333; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#fff;">🎟️ <b style="color:#9d00ff">${c.codigo}</b> - <span style="color:#00ff88">${c.desconto}% OFF</span></span>
                    <button onclick="deletarCupom('${c.codigo}')" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:1.2em;">🗑️</button>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

const formCupom = document.getElementById('form-cupom');
if(formCupom) {
    formCupom.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codigo = document.getElementById('codigo-cupom').value;
        const desconto = document.getElementById('valor-cupom').value;
        await fetch('/api/cupons', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ codigo, desconto }) });
        alert("Cupom criado!");
        e.target.reset();
        carregarCupons();
    });
}

window.deletarCupom = async function(cod) {
    if(confirm("Apagar cupom?")) { await fetch(`/api/cupons/${cod}`, { method: 'DELETE' }); carregarCupons(); }
};

// ==========================================
// 4. GESTÃO DE PEDIDOS (RECUPERADA)
// ==========================================
async function carregarVendas() {
    const container = document.getElementById('lista-vendas');
    if(!container) return;
    container.innerHTML = '<p style="color:#888">Buscando pedidos...</p>';
    
    try {
        const res = await fetch('/api/vendas');
        const vendas = await res.json();
        container.innerHTML = '';
        
        if(vendas.length === 0) { container.innerHTML = '<p style="color:#666">Nenhuma venda registrada.</p>'; return; }
        
        vendas.forEach(v => {
            const isPendente = v.status === 'Pendente';
            const statusColor = isPendente ? '#ffaa00' : '#00ff88';
            
            // Botão de ação ou texto de concluído
            const btnAcao = isPendente 
                ? `<button onclick="confirmarVenda(${v.id_pedido})" style="background: rgba(0,255,136,0.1); color:#00ff88; border:1px solid #00ff88; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; margin-top:10px;">✅ APROVAR E BAIXAR ESTOQUE</button>`
                : `<div style="margin-top:10px; color:#666; font-size:0.9em; text-align:right;">Concluído</div>`;

            let itensHtml = v.itens.map(i => `<li style="margin-bottom:5px;">${i.qtd}x <span style="color:#fff">${i.produto}</span> <span style="color:#888">(${i.marca})</span></li>`).join('');
            
            // Formatar data se for ISO
            let dataDisplay = v.data;
            try {
                if(v.data.includes('T')) {
                    const d = new Date(v.data);
                    dataDisplay = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR').slice(0,5);
                }
            } catch(e){}

            container.innerHTML += `
                <div class="card-item" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 15px; background: #0a0a0a; border-radius: 5px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="font-size:1.1em; color:#fff; margin-bottom:5px;"><strong>PEDIDO #${v.id_pedido}</strong></div>
                            <div style="color:#ddd; margin-bottom:5px;">Cliente: ${v.cliente}</div>
                            <small style="color:#888;">📅 ${dataDisplay}</small>
                            <ul style="margin:15px 0; padding-left:20px; color:#ccc;">${itensHtml}</ul>
                            <div style="font-size:1.2em; color:#ffd700;">TOTAL: <b>R$ ${parseFloat(v.total).toFixed(2)}</b></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="margin-bottom:10px; font-weight:bold; color:${statusColor};">${v.status.toUpperCase()}</div>
                        </div>
                    </div>
                    ${btnAcao}
                </div>`;
        });
    } catch (e) { console.error(e); }
}

window.confirmarVenda = async function(id) {
    if(!confirm("Isso irá baixar o estoque dos produtos. Confirmar aprovação?")) return;
    try {
        const res = await fetch(`/api/venda/${id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if(res.ok) { 
            alert("✅ Venda aprovada!");
            carregarVendas(); 
            carregarDashboard(); // Atualiza gráficos
            carregarListaAdmin(); // Atualiza lista de estoque se estiver visível
        } 
        else { alert("Erro: " + data.message); }
    } catch (e) { alert("Erro de conexão"); }
};

// ==========================================
// 5. CONFIGURAÇÕES E BANNERS (ATUALIZADO)
// ==========================================

async function carregarConfiguracoesNoForm() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();

        // Campos Visuais
        if (document.getElementById('config-nome')) {
            if (config.nomeLoja) document.getElementById('config-nome').value = config.nomeLoja;
            if (config.corDestaque) document.getElementById('config-cor').value = config.corDestaque;
        }

        // Campos Sociais
        if (document.getElementById('social-zap-pedidos')) {
            const zap = config.whatsapp || config.whatsappPedidos;
            if (zap) document.getElementById('social-zap-pedidos').value = zap;
            if (config.whatsappFlutuante) document.getElementById('social-zap-float').value = config.whatsappFlutuante;
            if (config.instagramLink) document.getElementById('social-insta').value = config.instagramLink;
        }
        
    } catch (error) {
        console.error("Erro ao ler config:", error);
    }
}

async function salvarConfigGeneric(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    const formData = new FormData(e.target);

    try {
        await fetch('/api/config', { method: 'POST', body: formData });
        alert("✅ Configurações salvas com sucesso!");
    } catch (error) {
        alert("Erro ao salvar.");
        console.error(error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}