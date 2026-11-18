use std::collections::{HashSet, VecDeque};

struct PetriNet {
    marking: Vec<usize>,
    pre_matrix: Vec<Vec<usize>>,
    post_matrix: Vec<Vec<usize>>,
}

impl PetriNet {
    fn new(marking: Vec<usize>, pre: Vec<Vec<usize>>, post: Vec<Vec<usize>>) -> Self {
        assert_eq!(pre.len(), post.len());
        assert!(pre.iter().chain(&post).all(|row| row.len() == marking.len()));
        Self { marking, pre_matrix: pre, post_matrix: post }
    }

    fn enabled_at(&self, marking: &[usize], t: usize) -> bool {
        self.pre_matrix.get(t).is_some_and(|pre| {
            marking.iter().zip(pre).all(|(tokens, required)| tokens >= required)
        })
    }

    fn is_enabled(&self, t: usize) -> bool {
        self.enabled_at(&self.marking, t)
    }

    fn successor(&self, marking: &[usize], t: usize) -> Result<Vec<usize>, &'static str> {
        if !self.enabled_at(marking, t) {
            return Err("Transición inexistente o no habilitada");
        }
        marking.iter().enumerate().map(|(p, &tokens)| {
            (tokens - self.pre_matrix[t][p])
                .checked_add(self.post_matrix[t][p])
                .ok_or("Capacidad numérica excedida")
        }).collect()
    }

    fn fire(&mut self, t: usize) -> Result<(), &'static str> {
        let next = self.successor(&self.marking, t)?;
        self.marking = next;
        Ok(())
    }

    // Para las redes pequeñas y acotadas de esta actividad.
    fn reachable_markings(&self) -> Vec<Vec<usize>> {
        let mut queue = VecDeque::from([self.marking.clone()]);
        let mut visited = HashSet::from([self.marking.clone()]);
        let mut result = Vec::new();

        while let Some(marking) = queue.pop_front() {
            for t in 0..self.pre_matrix.len() {
                if self.enabled_at(&marking, t) {
                    let next = self.successor(&marking, t).expect("Marcado fuera de rango");
                    if visited.insert(next.clone()) {
                        queue.push_back(next);
                    }
                }
            }
            result.push(marking);
        }
        result
    }
}

fn main() {
    // Lugares: Pre A, SC A, Post A, Libre, Pre B, SC B, Post B.
    // Transiciones: adquirir A, liberar A, adquirir B, liberar B.
    let mut mutex = PetriNet::new(
        vec![1, 0, 0, 1, 1, 0, 0],
        vec![
            vec![1, 0, 0, 1, 0, 0, 0],
            vec![0, 1, 0, 0, 0, 0, 0],
            vec![0, 0, 0, 1, 1, 0, 0],
            vec![0, 0, 0, 0, 0, 1, 0],
        ],
        vec![
            vec![0, 1, 0, 0, 0, 0, 0],
            vec![0, 0, 1, 1, 0, 0, 0],
            vec![0, 0, 0, 0, 0, 1, 0],
            vec![0, 0, 0, 1, 0, 0, 1],
        ],
    );
    let reachable = mutex.reachable_markings();
    assert_eq!(reachable.len(), 8);
    for m in &reachable {
        assert_eq!(m[1] + m[3] + m[5], 1);
        assert!(m[1] + m[5] <= 1);
        println!("{m:?}");
    }
    assert!(mutex.is_enabled(0));
    mutex.fire(0).unwrap();
    assert!(!mutex.is_enabled(2));
}