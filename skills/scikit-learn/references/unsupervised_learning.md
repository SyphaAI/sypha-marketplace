# Unsupervised Learning Reference

## Overview

Unsupervised learning identifies structure in unlabeled data by means of clustering, dimensionality reduction, and density estimation.

## Clustering

### K-Means

**KMeans (`sklearn.cluster.KMeans`)**
- Partitions data into K clusters
- Key parameters:
  - `n_clusters`: Number of clusters to form
  - `init`: Initialization method ('k-means++', 'random')
  - `n_init`: Number of initializations (default=10)
  - `max_iter`: Maximum iterations
- Use when: Cluster count is known and clusters are roughly spherical
- Fast and scalable
- Example:
```python
from sklearn.cluster import KMeans

model = KMeans(n_clusters=3, init='k-means++', n_init=10, random_state=42)
labels = model.fit_predict(X)
centers = model.cluster_centers_

# Inertia (sum of squared distances to nearest center)
print(f"Inertia: {model.inertia_}")
```

**MiniBatchKMeans**
- Accelerated K-Means variant that processes data in mini-batches
- Use when: Dataset is large and training speed matters
- Marginally less accurate than standard K-Means
- Example:
```python
from sklearn.cluster import MiniBatchKMeans

model = MiniBatchKMeans(n_clusters=3, batch_size=100, random_state=42)
labels = model.fit_predict(X)
```

### Density-Based Clustering

**DBSCAN (`sklearn.cluster.DBSCAN`)**
- Density-Based Spatial Clustering
- Key parameters:
  - `eps`: Maximum distance between two samples to be neighbors
  - `min_samples`: Minimum samples in neighborhood to form core point
  - `metric`: Distance metric
- Use when: Clusters have irregular shapes or the data contains noise/outliers
- Determines cluster count automatically
- Assigns noise points the label -1
- Example:
```python
from sklearn.cluster import DBSCAN

model = DBSCAN(eps=0.5, min_samples=5, metric='euclidean')
labels = model.fit_predict(X)

# Number of clusters (excluding noise)
n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)
print(f"Clusters: {n_clusters}, Noise points: {n_noise}")
```

**HDBSCAN (`sklearn.cluster.HDBSCAN`)**
- Hierarchical DBSCAN with adaptive epsilon (added in scikit-learn 1.3)
- More robust than DBSCAN; prefer this over the standalone `hdbscan` PyPI package for new projects
- Key parameter: `min_cluster_size`
- Use when: Clusters have varying densities
- Example:
```python
from sklearn.cluster import HDBSCAN

model = HDBSCAN(min_cluster_size=10, min_samples=5)
labels = model.fit_predict(X)
```

**OPTICS (`sklearn.cluster.OPTICS`)**
- Orders points to reveal clustering structure
- Comparable to DBSCAN but does not require the eps parameter
- Key parameters: `min_samples`, `max_eps`
- Use when: Density varies across the data or during exploratory analysis
- Example:
```python
from sklearn.cluster import OPTICS

model = OPTICS(min_samples=5, max_eps=0.5)
labels = model.fit_predict(X)
```

### Hierarchical Clustering

**AgglomerativeClustering**
- Builds clusters from the bottom up in a hierarchical fashion
- Key parameters:
  - `n_clusters`: Number of clusters (or use `distance_threshold`)
  - `linkage`: 'ward', 'complete', 'average', 'single'
  - `metric`: Distance metric
- Use when: A dendrogram is needed or hierarchical structure is important
- Example:
```python
from sklearn.cluster import AgglomerativeClustering

model = AgglomerativeClustering(n_clusters=3, linkage='ward')
labels = model.fit_predict(X)

# Create dendrogram using scipy
from scipy.cluster.hierarchy import dendrogram, linkage
Z = linkage(X, method='ward')
dendrogram(Z)
```

### Other Clustering Methods

**MeanShift**
- Locates clusters by iteratively shifting points toward the highest local density
- Determines cluster count automatically
- Key parameter: `bandwidth`
- Use when: Cluster count is unknown and shapes are arbitrary
- Example:
```python
from sklearn.cluster import MeanShift, estimate_bandwidth

# Estimate bandwidth
bandwidth = estimate_bandwidth(X, quantile=0.2, n_samples=500)
model = MeanShift(bandwidth=bandwidth)
labels = model.fit_predict(X)
```

**SpectralClustering**
- Applies a graph-based approach using eigenvalue decomposition
- Key parameters: `n_clusters`, `affinity` ('rbf', 'nearest_neighbors')
- Use when: Clusters are non-convex or data has a graph structure
- Example:
```python
from sklearn.cluster import SpectralClustering

model = SpectralClustering(n_clusters=3, affinity='rbf', random_state=42)
labels = model.fit_predict(X)
```

**AffinityPropagation**
- Identifies exemplar points through iterative message passing
- Determines cluster count automatically
- Key parameters: `damping`, `preference`
- Use when: Cluster count is not known in advance
- Example:
```python
from sklearn.cluster import AffinityPropagation

model = AffinityPropagation(damping=0.9, random_state=42)
labels = model.fit_predict(X)
n_clusters = len(model.cluster_centers_indices_)
```

**BIRCH**
- Balanced Iterative Reducing and Clustering using Hierarchies
- Memory-efficient algorithm suited to large datasets
- Key parameters: `n_clusters`, `threshold`, `branching_factor`
- Use when: Dataset is very large
- Example:
```python
from sklearn.cluster import Birch

model = Birch(n_clusters=3, threshold=0.5)
labels = model.fit_predict(X)
```

### Clustering Evaluation

**Metrics when ground truth is known:**
```python
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from sklearn.metrics import adjusted_mutual_info_score, fowlkes_mallows_score

# Compare predicted labels with true labels
ari = adjusted_rand_score(y_true, y_pred)
nmi = normalized_mutual_info_score(y_true, y_pred)
ami = adjusted_mutual_info_score(y_true, y_pred)
fmi = fowlkes_mallows_score(y_true, y_pred)
```

**Metrics without ground truth:**
```python
from sklearn.metrics import silhouette_score, calinski_harabasz_score
from sklearn.metrics import davies_bouldin_score

# Silhouette: [-1, 1], higher is better
silhouette = silhouette_score(X, labels)

# Calinski-Harabasz: higher is better
ch_score = calinski_harabasz_score(X, labels)

# Davies-Bouldin: lower is better
db_score = davies_bouldin_score(X, labels)
```

**Elbow method for K-Means:**
```python
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

inertias = []
K_range = range(2, 11)
for k in K_range:
    model = KMeans(n_clusters=k, random_state=42)
    model.fit(X)
    inertias.append(model.inertia_)

plt.plot(K_range, inertias, 'bo-')
plt.xlabel('Number of clusters')
plt.ylabel('Inertia')
plt.title('Elbow Method')
```

## Dimensionality Reduction

### Principal Component Analysis (PCA)

**PCA (`sklearn.decomposition.PCA`)**
- Performs linear dimensionality reduction via SVD
- Key parameters:
  - `n_components`: Number of components (int or float for explained variance)
  - `whiten`: Whiten components to unit variance
- Use when: Relationships are linear and you need to account for explained variance
- Example:
```python
from sklearn.decomposition import PCA

# Keep components explaining 95% variance
pca = PCA(n_components=0.95)
X_reduced = pca.fit_transform(X)

print(f"Original dimensions: {X.shape[1]}")
print(f"Reduced dimensions: {X_reduced.shape[1]}")
print(f"Explained variance ratio: {pca.explained_variance_ratio_}")
print(f"Total variance explained: {pca.explained_variance_ratio_.sum()}")

# Or specify exact number of components
pca = PCA(n_components=2)
X_2d = pca.fit_transform(X)
```

**IncrementalPCA**
- PCA implementation designed for datasets too large to hold in memory
- Processes data in chunks
- Key parameter: `n_components`, `batch_size`
- Example:
```python
from sklearn.decomposition import IncrementalPCA

pca = IncrementalPCA(n_components=50, batch_size=100)
X_reduced = pca.fit_transform(X)
```

**KernelPCA**
- Extends PCA to handle non-linear structures via kernel functions
- Key parameters: `n_components`, `kernel` ('linear', 'poly', 'rbf', 'sigmoid')
- Use when: Data has non-linear relationships
- Example:
```python
from sklearn.decomposition import KernelPCA

pca = KernelPCA(n_components=2, kernel='rbf', gamma=0.1)
X_reduced = pca.fit_transform(X)
```

### Manifold Learning

**t-SNE (`sklearn.manifold.TSNE`)**
- t-distributed Stochastic Neighbor Embedding
- Well-suited for 2D/3D visualization tasks
- Key parameters:
  - `n_components`: Usually 2 or 3
  - `perplexity`: Balance between local and global structure (5-50)
  - `learning_rate`: Usually 10-1000
  - `max_iter`: Number of iterations (minimum 250; renamed from `n_iter` in 1.5)
- Use when: Visualizing high-dimensional data
- Note: Computationally slow on large datasets; does not provide a transform() method
- Example:
```python
from sklearn.manifold import TSNE

tsne = TSNE(n_components=2, perplexity=30, learning_rate=200, max_iter=1000, random_state=42)
X_embedded = tsne.fit_transform(X)

# Visualize
import matplotlib.pyplot as plt
plt.scatter(X_embedded[:, 0], X_embedded[:, 1], c=labels, cmap='viridis')
plt.title('t-SNE visualization')
```

**UMAP (not in scikit-learn, but compatible)**
- Uniform Manifold Approximation and Projection
- Runs faster than t-SNE and better preserves global structure
- Install: `uv pip install umap-learn`
- Example:
```python
from umap import UMAP

reducer = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
X_embedded = reducer.fit_transform(X)
```

**Isomap**
- Isometric Mapping
- Maintains geodesic distances between points
- Key parameters: `n_components`, `n_neighbors`
- Use when: Data lies on a non-linear manifold
- Example:
```python
from sklearn.manifold import Isomap

isomap = Isomap(n_components=2, n_neighbors=5)
X_embedded = isomap.fit_transform(X)
```

**Locally Linear Embedding (LLE)**
- Maintains the structure of local neighborhoods in the embedding
- Key parameters: `n_components`, `n_neighbors`
- Example:
```python
from sklearn.manifold import LocallyLinearEmbedding

lle = LocallyLinearEmbedding(n_components=2, n_neighbors=10)
X_embedded = lle.fit_transform(X)
```

**MDS (Multidimensional Scaling)**
- Produces an embedding that preserves pairwise distances
- Key parameters: `n_components`, `metric`, `metric_params`, `init` (e.g. `'classical_mds'` in 1.8+)
- Note: `dissimilarity` is deprecated; the former `metric` boolean was renamed to `metric_mds`
- Example:
```python
from sklearn.manifold import MDS

mds = MDS(n_components=2, metric='euclidean', init='classical_mds', random_state=42)
X_embedded = mds.fit_transform(X)
```

**ClassicalMDS (`sklearn.manifold.ClassicalMDS`)**
- Implements classical (Torgerson) MDS through eigendecomposition of the double-centered distance matrix
- Introduced in scikit-learn 1.8; provides a faster initialization path for `MDS`
- Example:
```python
from sklearn.manifold import ClassicalMDS

cmds = ClassicalMDS(n_components=2, random_state=42)
X_embedded = cmds.fit_transform(X)
```

### Matrix Factorization

**NMF (Non-negative Matrix Factorization)**
- Decomposes data into two non-negative factor matrices
- Key parameters: `n_components`, `init` ('nndsvd', 'random')
- Use when: Data values are non-negative (e.g., images, text)
- Produces interpretable components
- Example:
```python
from sklearn.decomposition import NMF

nmf = NMF(n_components=10, init='nndsvd', random_state=42)
W = nmf.fit_transform(X)  # Document-topic matrix
H = nmf.components_  # Topic-word matrix
```

**TruncatedSVD**
- Applies SVD directly to sparse matrices
- Functionally similar to PCA but operates on sparse data without centering
- Use when: Working with text data or sparse matrix representations
- Example:
```python
from sklearn.decomposition import TruncatedSVD

svd = TruncatedSVD(n_components=100, random_state=42)
X_reduced = svd.fit_transform(X_sparse)
print(f"Explained variance: {svd.explained_variance_ratio_.sum()}")
```

**FastICA**
- Independent Component Analysis
- Decomposes a multivariate signal into statistically independent components
- Key parameter: `n_components`
- Use when: Source separation is the goal (e.g., audio, EEG signals)
- Example:
```python
from sklearn.decomposition import FastICA

ica = FastICA(n_components=10, random_state=42)
S = ica.fit_transform(X)  # Independent sources
A = ica.mixing_  # Mixing matrix
```

**LatentDirichletAllocation (LDA)**
- Probabilistic topic model for text corpora
- Key parameters: `n_components` (number of topics), `learning_method` ('batch', 'online')
- Use when: Extracting topics from documents or clustering text
- Example:
```python
from sklearn.decomposition import LatentDirichletAllocation

lda = LatentDirichletAllocation(n_components=10, random_state=42)
doc_topics = lda.fit_transform(X_counts)  # Document-topic distribution

# Get top words for each topic
feature_names = vectorizer.get_feature_names_out()
for topic_idx, topic in enumerate(lda.components_):
    top_words = [feature_names[i] for i in topic.argsort()[-10:]]
    print(f"Topic {topic_idx}: {', '.join(top_words)}")
```

## Outlier and Novelty Detection

### Outlier Detection

**IsolationForest**
- Detects anomalies by isolating observations with random trees
- Key parameters:
  - `contamination`: Expected proportion of outliers
  - `n_estimators`: Number of trees
- Use when: Data is high-dimensional and computational efficiency is a priority
- Example:
```python
from sklearn.ensemble import IsolationForest

model = IsolationForest(contamination=0.1, random_state=42)
predictions = model.fit_predict(X)  # -1 for outliers, 1 for inliers
```

**LocalOutlierFactor**
- Scores each point by its local density relative to its neighbors
- Key parameters: `n_neighbors`, `contamination`
- Use when: Data has regions with varying density
- Example:
```python
from sklearn.neighbors import LocalOutlierFactor

lof = LocalOutlierFactor(n_neighbors=20, contamination=0.1)
predictions = lof.fit_predict(X)  # -1 for outliers, 1 for inliers
outlier_scores = lof.negative_outlier_factor_
```

**One-Class SVM**
- Learns a decision boundary that encloses normal training examples
- Key parameters: `nu` (upper bound on outliers), `kernel`, `gamma`
- Use when: Only a small set of normal (in-class) training samples is available
- Example:
```python
from sklearn.svm import OneClassSVM

model = OneClassSVM(nu=0.1, kernel='rbf', gamma='auto')
model.fit(X_train)
predictions = model.predict(X_test)  # -1 for outliers, 1 for inliers
```

**EllipticEnvelope**
- Fits a robust covariance estimate assuming Gaussian-distributed data
- Key parameter: `contamination`
- Use when: The data follows an approximately Gaussian distribution
- Example:
```python
from sklearn.covariance import EllipticEnvelope

model = EllipticEnvelope(contamination=0.1, random_state=42)
predictions = model.fit_predict(X)
```

## Gaussian Mixture Models

**GaussianMixture**
- Models data as a mixture of Gaussians for probabilistic cluster assignment
- Key parameters:
  - `n_components`: Number of mixture components
  - `covariance_type`: 'full', 'tied', 'diag', 'spherical'
- Use when: Soft cluster membership or per-cluster probability estimates are required
- Example:
```python
from sklearn.mixture import GaussianMixture

gmm = GaussianMixture(n_components=3, covariance_type='full', random_state=42)
gmm.fit(X)

# Predict cluster labels
labels = gmm.predict(X)

# Get probability of each cluster
probabilities = gmm.predict_proba(X)

# Information criteria for model selection
print(f"BIC: {gmm.bic(X)}")  # Lower is better
print(f"AIC: {gmm.aic(X)}")  # Lower is better
```

## Choosing the Right Method

### Clustering:
- **Know K, spherical clusters**: K-Means
- **Arbitrary shapes, noise**: DBSCAN, HDBSCAN
- **Hierarchical structure**: AgglomerativeClustering
- **Very large data**: MiniBatchKMeans, BIRCH
- **Probabilistic**: GaussianMixture

### Dimensionality Reduction:
- **Linear, variance explanation**: PCA
- **Non-linear, visualization**: t-SNE, UMAP
- **Non-negative data**: NMF
- **Sparse data**: TruncatedSVD
- **Topic modeling**: LatentDirichletAllocation

### Outlier Detection:
- **High-dimensional**: IsolationForest
- **Varying density**: LocalOutlierFactor
- **Gaussian data**: EllipticEnvelope
