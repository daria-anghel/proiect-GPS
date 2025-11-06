import osmnx as ox
import json
import os


def generate_brasov_map():
    print("🗺️  Se descarcă harta Brașovului din OpenStreetMap...")

    # descarcă rețeaua rutieră (pentru vehicule)
    G = ox.graph_from_place("Brașov, Romania", network_type="drive")

    print(
        f"✅ Hartă descărcată: {len(G.nodes)} noduri, {len(G.edges)} legături")

    # convertim într-un format simplificat (dicționar)
    simplified_map = {}
    for node, neighbors in G.adjacency():
        simplified_map[str(node)] = {
            str(neighbor): float(data[0].get("length", 1.0))
            for neighbor, data in neighbors.items()
        }

    # asigură-te că folderul data/ există
    os.makedirs("data", exist_ok=True)

    # salvăm în fișierul JSON
    with open("data/map_data.json", "w", encoding="utf-8") as f:
        json.dump(simplified_map, f, indent=4, ensure_ascii=False)

    print("💾 Harta Brașovului a fost salvată cu succes în data/map_data.json")


if __name__ == "__main__":
    generate_brasov_map()
