# Redes de Petri · Módulo 11

Material de Programación Concurrente de la Facultad de Ingeniería de la Universidad de Buenos Aires. Incluye teoría, siete modelos interactivos y los trece ejercicios de la Actividad 11 con sus resoluciones.

## GitHub Pages

**Dirección del sitio** [cintiacapece.github.io/redes-de-petri](https://cintiacapece.github.io/redes-de-petri/).

La fuente de publicación es la raíz de `main`. La configuración se encuentra en [Settings → Pages](https://github.com/CintiaCapece/redes-de-petri/settings/pages). Para una vista local, abrí [index.html](index.html) en un navegador.

## Ejemplos en Rust

Instalá Rust estable y Cargo con [rustup](https://rust-lang.org/tools/install/). Desde la raíz del repositorio:

```sh
cargo build --manifest-path rust/Cargo.toml --bins
cargo run --manifest-path rust/Cargo.toml --bin motor
cargo run --manifest-path rust/Cargo.toml --bin buffer
cargo run --manifest-path rust/Cargo.toml --bin dos_fases
```

- [`motor`](rust/motor.rs) explora los ocho marcados alcanzables del mutex y comprueba la exclusión mutua.
- [`buffer`](rust/buffer.rs) muestra cómo un canal acotado de Tokio aplica contrapresión.
- [`dos_fases`](rust/dos_fases.rs) simula el cierre del canal de decisión después del voto y comprueba que la transacción queda en `Prepared`.
