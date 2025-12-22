// public/js/script.js

let produtosGlobais = [];
let carrinho = []; // ARRAY NOVO: Guarda os itens comprados
let produtoSelecionado = null;
let variacaoSelecionada = null;

// 1. Carregar Produtos
async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/produtos');
        produtosGlobais = await resposta.json();
        
        const container = document.getElementById('lista-produtos');
        container.innerHTML = ''; 

        if (produtosGlobais.length === 0) {
            container.innerHTML = '<p class="aviso-vazio">Nenhum produto cadastrado.</p>';
            return;
        }

        produtosGlobais.forEach(produto => {
            let menorPreco = 0;
            if(produto.variacoes && produto.variacoes.length > 0) {
                menorPreco = Math.min(...produto.variacoes.map(v => v.preco_venda));
            }

            const html = `
                <div class="card">
                    <img src="${produto.imagem || 'assets/sem-foto.png'}" alt="${produto.nome}">
                    <h3>${produto.nome}</h3>
                    <p>A partir de R$ ${menorPreco.toFixed(2)}</p>
                    <button onclick="abrirModal(${produto.id})">Adicionar</button>
                </div>
            `;
            container.innerHTML += html;
        });
    } catch (erro) { console.error(erro); }
}

// 2. Modal de Detalhes (Produto)
function abrirModal(idProduto) {
    produtoSelecionado = produtosGlobais.find(p => p.id === idProduto);
    if(!produtoSelecionado) return;

    document.getElementById('modal-titulo').innerText = produtoSelecionado.nome;
    document.getElementById('modal-img').src = produtoSelecionado.imagem || '';
    document.getElementById('preco-total').innerText = "R$ 0,00";
    
    // Muda o texto do botão para "Adicionar ao Carrinho"
    const btnAcao = document.querySelector('.modal-footer .btn-whatsapp');
    btnAcao.innerText = "Adicionar ao Carrinho 🛒";
    btnAcao.onclick = adicionarAoCarrinho; // Aponta para a nova função

    const lista = document.getElementById('lista-variacoes');
    lista.innerHTML = '';
    variacaoSelecionada = null;

    produtoSelecionado.variacoes.forEach((variacao, index) => {
        const desabilitado = variacao.estoque <= 0 ? 'disabled' : '';
        lista.innerHTML += `
            <label class="opcao-item">
                <div>
                    <input type="radio" name="opcao" value="${index}" onchange="selecionarOpcao(${index})" ${desabilitado}>
                    <strong>${variacao.marca}</strong>
                </div>
                <div>R$ ${variacao.preco_venda.toFixed(2)}</div>
            </label>
        `;
    });
    document.getElementById('modal-compra').style.display = 'flex';
}

function selecionarOpcao(index) {
    variacaoSelecionada = produtoSelecionado.variacoes[index];
    document.getElementById('preco-total').innerText = "R$ " + variacaoSelecionada.preco_venda.toFixed(2);
}

function fecharModal() { document.getElementById('modal-compra').style.display = 'none'; }

// Atualize a função adicionarAoCarrinho
function adicionarAoCarrinho() {
    if (!variacaoSelecionada) { alert("Selecione uma opção!"); return; }

    // 1. Pega a quantidade digitada
    const qtdInput = document.getElementById('qtd-produto');
    const quantidade = parseInt(qtdInput.value) || 1; // Se der erro, assume 1

    // 2. Verifica estoque (Opcional, mas profissional)
    if (quantidade > variacaoSelecionada.estoque) {
        alert(`Temos apenas ${variacaoSelecionada.estoque} unidades em estoque!`);
        return;
    }

    // 3. Cria o objeto do item com a quantidade e total calculado
    const item = {
        produto: produtoSelecionado.nome,
        marca: variacaoSelecionada.marca,
        precoUnitario: variacaoSelecionada.preco_venda,
        quantidade: quantidade,
        totalItem: variacaoSelecionada.preco_venda * quantidade
    };

    // Salva no array
    carrinho.push(item);

    // Reseta o input para 1 para a próxima compra
    qtdInput.value = 1;

    atualizarContador();
    fecharModal();
    alert(`${quantidade}x ${produtoSelecionado.nome} adicionado(s)!`);
}

function atualizarContador() {
    const btn = document.getElementById('btn-carrinho');
    const span = document.getElementById('contador-carrinho');
    
    span.innerText = carrinho.length;
    
    // Só mostra o botão se tiver algo no carrinho
    if(carrinho.length > 0) {
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

// 4. Abrir o Carrinho e Mostrar Lista (ATUALIZADO COM QUANTIDADE)
function abrirCarrinho() {
    const modal = document.getElementById('modal-carrinho');
    const lista = document.getElementById('itens-carrinho');
    const totalSpan = document.getElementById('total-carrinho');

    lista.innerHTML = '';
    let total = 0;

    // Loop para desenhar cada item
    carrinho.forEach((item, index) => {
        // Soma o total do item (preço x quantidade) que calculamos antes
        total += item.totalItem;

        lista.innerHTML += `
            <div class="item-carrinho">
                <div>
                    <strong>${item.quantidade}x</strong> ${item.produto} (${item.marca})
                </div>
                <div>
                    R$ ${item.totalItem.toFixed(2)}
                    <span class="btn-lixeira" onclick="removerItem(${index})">🗑️</span>
                </div>
            </div>
        `;
    });

    // Se tiver lógica de cupom implementada, aplique o desconto aqui no final
    // Exemplo: if(descontoAtual > 0) total = total * (1 - descontoAtual/100);

    totalSpan.innerText = "R$ " + total.toFixed(2);
    modal.style.display = 'flex';
}

function fecharCarrinho() { document.getElementById('modal-carrinho').style.display = 'none'; }

function removerItem(index) {
    carrinho.splice(index, 1); // Remove do array
    abrirCarrinho(); // Redesenha a tela
    atualizarContador();
}

// 5. Finalizar Compra (Loop do WhatsApp)
// 5. Finalizar Compra (ATUALIZADO COM QUANTIDADE)
function enviarPedidoZap(telefone) {
    if (carrinho.length === 0) return;

    const quebra = "%0A";
    let msg = `*PEDIDO NOVO!* 🛒${quebra}${quebra}`;

    let total = 0;

    // Loop para listar todos os itens na mensagem
    carrinho.forEach(item => {
        // Adiciona a quantidade na mensagem
        msg += `- ${item.quantidade}x ${item.produto} (${item.marca}): R$ ${item.totalItem.toFixed(2)}${quebra}`;
        total += item.totalItem;
    });

    // Se tiver cupom, você pode adicionar uma linha aqui mostrando o subtotal e o desconto
    
    msg += `${quebra}*Valor Total:* R$ ${total.toFixed(2)}${quebra}`;
    msg += `_Aguardo confirmação!_`;

    const link = `https://wa.me/${telefone}?text=${msg}`;
    window.open(link, '_blank');
}
let descontoAtual = 0; // % de desconto

async function aplicarCupom() {
    const codigo = document.getElementById('input-cupom').value;
    const msg = document.getElementById('msg-cupom');

    try {
        const res = await fetch(`/api/cupom/${codigo}`);
        const dados = await res.json();

        if (dados.valido) {
            descontoAtual = dados.desconto;
            msg.style.color = 'green';
            msg.innerText = `Desconto de ${dados.desconto}% aplicado!`;
            abrirCarrinho(); // Recarrega o carrinho para recalcular o total
        } else {
            descontoAtual = 0;
            msg.style.color = 'red';
            msg.innerText = "Cupom inválido.";
            abrirCarrinho();
        }
    } catch (e) { console.error(e); }
}

// Inicia
carregarProdutos();