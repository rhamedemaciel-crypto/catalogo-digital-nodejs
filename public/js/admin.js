// public/js/admin.js

// 1. Função que desenha uma nova linha de Marca/Preço na tela
function adicionarLinhaVariacao() {
    const container = document.getElementById('container-variacoes');
    
    const div = document.createElement('div');
    div.className = 'variacao-row';
    
    // HTML de uma linha de variação
    div.innerHTML = `
        <input type="text" placeholder="Opção (Ex: Lata, 600ml, Nike)" class="input-marca" required>
        <input type="number" placeholder="Custo (R$)" step="0.01" class="input-custo">
        <input type="number" placeholder="Venda (R$)" step="0.01" class="input-venda" required>
        <input type="number" placeholder="Estoque" class="input-estoque" value="100">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">🗑️</button>
    `;
    container.appendChild(div);
}

// Começa já com uma linha adicionada para facilitar
adicionarLinhaVariacao();

// 2. O Evento de Salvar (Enviar para o Backend)
document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede a página de recarregar sozinha

    const form = e.target;
    const formData = new FormData(); // Cria um pacote de dados para envio (suporta arquivos)

    // Adiciona os campos simples
    formData.append('nome', form.nome.value);
    formData.append('categoria', form.categoria.value);
    formData.append('imagem', form.imagem.files[0]); // Pega o arquivo de foto real

    // --- LÓGICA COMPLEXA: Ler todas as linhas de variações ---
    const variacoes = [];
    document.querySelectorAll('.variacao-row').forEach(linha => {
        variacoes.push({
            marca: linha.querySelector('.input-marca').value,
            preco_custo: parseFloat(linha.querySelector('.input-custo').value) || 0,
            preco_venda: parseFloat(linha.querySelector('.input-venda').value) || 0,
            estoque: parseInt(linha.querySelector('.input-estoque').value) || 0
        });
    });

    // Transforma o array de variações em texto para o servidor entender
    formData.append('variacoes', JSON.stringify(variacoes));

    try {
        // Envia para o servidor (server.js)
        const resposta = await fetch('/api/produtos', {
            method: 'POST',
            body: formData
        });

        if (resposta.ok) {
            alert("✅ Produto cadastrado com sucesso!");
            form.reset(); // Limpa os campos
            document.getElementById('container-variacoes').innerHTML = '';
            adicionarLinhaVariacao(); // Recria uma linha limpa
        } else {
            alert("❌ Erro ao salvar. Verifique o console.");
        }
    } catch (erro) {
        console.error(erro);
        alert("❌ Erro de conexão com o servidor.");
    }
});
async function carregarListaAdmin() {
    const container = document.getElementById('lista-produtos-admin');
    container.innerHTML = 'Carregando...';

    try {
        const resposta = await fetch('/api/produtos');
        const produtos = await resposta.json();

        container.innerHTML = ''; // Limpa

        if (produtos.length === 0) {
            container.innerHTML = '<p>Nenhum produto cadastrado.</p>';
            return;
        }

        // Desenha cada produto com um botão de excluir
        produtos.forEach(produto => {
            const item = document.createElement('div');
            // Estilo inline simples para alinhar (pode ir pro CSS depois)
            item.style = "display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 10px; border: 1px solid #ddd; border-radius: 5px;";
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${produto.imagem || ''}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                    <div>
                        <strong>${produto.nome}</strong><br>
                        <small>${produto.categoria}</small>
                    </div>
                </div>
                <button onclick="deletarProduto(${produto.id})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 5px;">
                    Excluir 🗑️
                </button>
            `;
            container.appendChild(item);
        });

    } catch (erro) {
        console.error("Erro ao listar:", erro);
    }
}

// 2. Função para deletar
async function deletarProduto(id) {
    if(!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
        const resposta = await fetch(`/api/produtos/${id}`, {
            method: 'DELETE'
        });

        if (resposta.ok) {
            alert("Produto removido!");
            carregarListaAdmin(); // Atualiza a lista na hora
        } else {
            alert("Erro ao remover.");
        }
    } catch (erro) {
        console.error(erro);
    }
}

// Carregar a lista assim que abrir a página admin
carregarListaAdmin();