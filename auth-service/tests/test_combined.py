import pytest

from scoring.combined import combine_scores


def test_combined_cases():
    # Case 1 (clean client): 2*0.02 + 1*0.5 + 1.5*0.4 - 1*min(0.05, 0)
    #   = 0.04 + 0.5 + 0.6 - 0 = 1.14 < 3.0 -> passed.
    s1, p1 = combine_scores(0.02, 0.5, 0.4, 0.05)
    assert s1 == pytest.approx(1.14)
    assert p1 is True

    # Case 2 (attacker): 2*0.9 + 1*8.0 + 1.5*0.95 - 1*min(-0.3, 0)
    #   = 1.8 + 8.0 + 1.425 + 0.3 = 11.525 >= 3.0 -> rejected.
    s2, p2 = combine_scores(0.9, 8.0, 0.95, -0.3)
    assert s2 == pytest.approx(11.525)
    assert p2 is False

    # Case 3 (perf drop alone is not enough):
    #   2*0.0 + 1*0.1 + 1.5*0.5 - 1*min(-0.2, 0) = 0 + 0.1 + 0.75 + 0.2
    #   = 1.05 < 3.0 -> passed.
    s3, p3 = combine_scores(0.0, 0.1, 0.5, -0.2)
    assert s3 == pytest.approx(1.05)
    assert p3 is True

    # Case 4 (custom weights/threshold):
    #   1*0.5 + 1*0.5 + 1*0.5 - 2*min(-0.1, 0) = 1.7 >= 1.0 -> rejected.
    s4, p4 = combine_scores(
        0.5,
        0.5,
        0.5,
        -0.1,
        weights={"outlier": 1.0, "shift": 1.0, "cluster": 1.0, "perf": 2.0},
        threshold=1.0,
    )
    assert s4 == pytest.approx(1.7)
    assert p4 is False

    print(
        f"[B4] case1_score={s1} case1_passed={p1} "
        f"case2_score={s2} case2_passed={p2} "
        f"case3_score={s3} case3_passed={p3} "
        f"case4_score={s4} case4_passed={p4}"
    )
