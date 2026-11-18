use std::{future::{poll_fn, Future}, task::Poll};
use tokio::sync::mpsc;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    const CAPACIDAD: usize = 2;
    let (tx, mut rx) = mpsc::channel(CAPACIDAD);
    tx.send(10).await.unwrap();
    tx.send(20).await.unwrap();

    let pendiente = tx.send(30);
    tokio::pin!(pendiente);
    // Consultamos una vez el futuro con el receptor abierto y el búfer lleno.
    // Pending significa que send cedería la ejecución si se esperara con await.
    poll_fn(|cx| {
        assert!(pendiente.as_mut().poll(cx).is_pending());
        Poll::Ready(())
    }).await;

    // Recibir devuelve una plaza: Ocupados → Libres.
    assert_eq!(rx.recv().await, Some(10));
    // El envío usa la plaza devuelta: Libres → Ocupados.
    pendiente.await.unwrap();
    assert_eq!(rx.recv().await, Some(20));
    assert_eq!(rx.recv().await, Some(30));
}