import numpy as np

from client_sim.partition import make_clients
from client_sim.simulated_client import SimulatedClient


def test_partition_non_iid_separation():
    clients = make_clients(8)

    dids = [c.client_did for c in clients]
    unique_dids = len(set(dids)) == 8

    means = [c.embed(n=32).mean(axis=0) for c in clients]
    embeddings_differ = all(
        not np.array_equal(means[i], means[j])
        for i in range(len(means))
        for j in range(i + 1, len(means))
    )

    assert len(clients) == 8
    assert unique_dids
    assert embeddings_differ

    # SimulatedClient wraps an adapter and trains through it.
    wrapped = SimulatedClient(clients[0], clients[0].client_did)
    assert wrapped.client_did == "client-0"
    assert set(wrapped.run_round().keys()) == {"layer1", "layer2", "head"}

    print(
        f"[C1] n_clients=8 unique_dids={unique_dids} "
        f"embeddings_differ={embeddings_differ}"
    )
