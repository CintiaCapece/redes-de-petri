use std::time::Duration;
use tokio::{sync::oneshot, time::timeout};

#[derive(Debug, PartialEq)]
enum Decision { Commit, Abort }

#[derive(Debug, PartialEq)]
enum Estado { Prepared, Committed, Aborted }

async fn participante(
    voto_si: oneshot::Sender<()>,
    decision: oneshot::Receiver<Decision>,
) -> Estado {
    // Simula haber registrado Prepared de forma durable antes de votar Sí.
    voto_si.send(()).expect("Coordinador desconectado antes del voto");
    match timeout(Duration::from_secs(1), decision).await {
        Ok(Ok(Decision::Commit)) => Estado::Committed,
        Ok(Ok(Decision::Abort)) => Estado::Aborted,
        Ok(Err(_)) | Err(_) => Estado::Prepared,
    }
}

async fn escenario(decision: Option<Decision>) -> Estado {
    let (voto_tx, voto_rx) = oneshot::channel();
    let (decision_tx, decision_rx) = oneshot::channel();
    let tarea = tokio::spawn(participante(voto_tx, decision_rx));
    voto_rx.await.unwrap();
    if let Some(decision) = decision {
        decision_tx.send(decision).unwrap();
    } else {
        // El coordinador cae después del voto. El cierre es observable,
        // pero no contiene una decisión de la transacción.
        drop(decision_tx);
    }
    tarea.await.unwrap()
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let estado = escenario(None).await;
    assert_eq!(estado, Estado::Prepared);
    assert_eq!(escenario(Some(Decision::Commit)).await, Estado::Committed);
    assert_eq!(escenario(Some(Decision::Abort)).await, Estado::Aborted);
    println!("Tras la caída: {estado:?}. Hace falta resolver la decisión durable.");
}