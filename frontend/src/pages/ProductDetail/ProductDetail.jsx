import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProductService from '../../services/product/ProductService';
import ProductOverview from './components/ProductOverview';
import ApiKeysSection from './components/ApiKeysSection';
import Loader from '../../components/Loader/Loader';
import Button from '../../components/Button/Button';
import './ProductDetail.scss';

export const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await ProductService.getProductDetails(id);
        setProduct(data);
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleSaveWebhook = async (url) => {
    try {
      await ProductService.updateApiConfig(product?.id, { webhookUrl: url });
      alert('Webhook endpoint updated successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Loader message="Loading payment product configuration..." />;
  }

  if (!product) {
    return (
      <div className="container py-8">
        <p className="text-danger">Product details not found.</p>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <div className="product-detail-page__header flex-between flex-wrap gap-4">
          <div>
            <h1>Product Engine Architecture</h1>
            <p>Configure routing algorithms, settlement parameters, and gateway credentials</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => alert('Download API Spec YAML')}
            >
              OpenAPI Spec
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => alert('Changes committed to staging environment')}
            >
              Deploy Changes
            </Button>
          </div>
        </div>

        {/* Overview banner */}
        <ProductOverview product={product} />

        {/* Features list */}
        <h3 className="section-title font-bold text-xl mb-4">Core Engine Capabilities</h3>
        <div className="features-grid">
          {product.features?.map((feat, idx) => (
            <div key={idx} className="card feature-card">
              <div className="flex-between mb-2">
                <h4>{feat.name}</h4>
                <span className="badge badge--success">Active</span>
              </div>
              <p>{feat.description}</p>
            </div>
          ))}
        </div>

        {/* Developer API & Webhooks */}
        <ApiKeysSection
          apiConfig={product.apiConfig}
          onSaveWebhook={handleSaveWebhook}
        />

        {/* Pricing & Commercial Structure */}
        <div className="card pricing-card mb-8">
          <h3 className="section-title font-bold text-lg mb-4">Commercial Pricing & Settlement SLA</h3>
          <div className="price-row">
            <span className="text-secondary font-medium">Pricing Plan</span>
            <span className="font-semibold text-primary">{product.pricing?.tier}</span>
          </div>
          <div className="price-row">
            <span className="text-secondary font-medium">Interchange / Processing Fee</span>
            <span className="font-semibold">{product.pricing?.baseFee}</span>
          </div>
          <div className="price-row">
            <span className="text-secondary font-medium">Platform Platform Base</span>
            <span className="font-semibold">{product.pricing?.monthlySubscription}</span>
          </div>
          <div className="price-row">
            <span className="text-secondary font-medium">Auto-Settlement Window</span>
            <span className="font-semibold text-success">{product.pricing?.settlementCycle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
