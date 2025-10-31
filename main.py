from core.graph import Graph


def main():
    print("=== Testare încărcare hartă reală ===")
    graph = Graph("data/map_data.json")

    print(f"Număr total de noduri: {len(graph.nodes())}")
    print(f"Exemplu vecini pentru primul nod:")

    first_node = graph.nodes()[0]
    print(f"{first_node} -> {graph.neighbors(first_node)}")

    # Arată un fragment mic din hartă
    graph.display(limit=3)


if __name__ == "__main__":
    main()
