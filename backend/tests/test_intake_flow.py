import pytest
from app.db.store import reset_memory_store
from app.services.intake import confirm_treatment, handle_inbound_chat, run_intake


@pytest.mark.asyncio
async def test_whatsapp_clarify_and_confirm():
    reset_memory_store()
    reply1 = await handle_inbound_chat("5511000000001", "Dipirona 500mg de 6 em 6 horas começando agora")
    assert "dias" in reply1.lower()
    reply2 = await handle_inbound_chat("5511000000001", "por 3 dias")
    assert "CONFIRMAR" in reply2
    reply3 = await handle_inbound_chat("5511000000001", "CONFIRMAR")
    assert "ativado" in reply3.lower()


@pytest.mark.asyncio
async def test_app_intake_confirm():
    reset_memory_store()
    result = await run_intake(
        "Amoxicilina 500mg de 8 em 8 horas por 7 dias, começando amanhã às 8h. Me avisa 15 minutos antes.",
        phone="5511000000002",
    )
    assert result.status == "ready_for_confirm"
    treatment = confirm_treatment(result.draft_id)
    assert treatment["status"] == "active"
