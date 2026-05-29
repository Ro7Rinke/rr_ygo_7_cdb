import os
import json
from concurrent.futures import ProcessPoolExecutor

# Caminhos dos diretórios
INPUT_DIR = os.path.join("data", "individual", "sets")
OUTPUT_FILE = "all-rarities.json"

def extract_rarities_from_file(file_path):
    """
    Lê um arquivo JSON de set e extrai todas as raridades únicas dele.
    """
    rarities = set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Navega pela estrutura: contents -> cards -> rarity
            contents = data.get("contents", [])
            for content in contents:
                cards = content.get("cards", [])
                for card in cards:
                    rarity = card.get("rarity")
                    if rarity:
                        rarities.add(str(rarity).strip().lower()) # Padroniza para evitar duplicatas por espaço/caixa
                        
    except Exception as e:
        print(f"Erro ao processar o arquivo {file_path}: {e}")
        
    return rarities

def main():
    # Verifica se o diretório de entrada existe
    if not os.path.exists(INPUT_DIR):
        print(f"Diretório de entrada não encontrado: {INPUT_DIR}")
        return

    # Lista todos os arquivos .json da pasta
    json_files = [
        os.path.join(INPUT_DIR, f) 
        for f in os.listdir(INPUT_DIR) 
        if f.endswith('.json')
    ]

    if not json_files:
        print("Nenhum arquivo JSON encontrado no diretório especificado.")
        return

    print(f"Encontrados {len(json_files)} arquivos para processar.")
    print("Iniciando processamento multinúcleo...")

    global_rarities = set()

    # Usa o ProcessPoolExecutor para distribuir a carga de CPU em múltiplos cores
    # O max_workers padrão já é a quantidade de núcleos da sua máquina
    with ProcessPoolExecutor() as executor:
        # Mapeia a função de extração para todos os arquivos em paralelo
        results = executor.map(extract_rarities_from_file, json_files)
        
        # Junta o set de resultados de cada processo no set global
        for file_rarities in results:
            global_rarities.update(file_rarities)

    # Converte o set global de volta para uma lista ordenada
    sorted_rarities = sorted(list(global_rarities))

    # Salva o arquivo de saída formatado
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted_rarities, f, indent=2, ensure_ascii=False)

    print("---")
    print(f"Processamento concluído com sucesso!")
    print(f"Total de raridades únicas encontradas: {len(sorted_rarities)}")
    print(f"Resultado salvo em: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()