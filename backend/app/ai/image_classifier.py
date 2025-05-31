import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
from PIL import Image as PILImage
import os

# --- Configuration ---
MODEL_URL = "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/5"
# Alternative: "https://tfhub.dev/google/tf2-preview/mobilenet_v2/classification/4" (older)
# For better accuracy but larger model, EfficientNet:
# "https://tfhub.dev/tensorflow/efficientnet/b0/classification/1" (input 224x224)
# "https://tfhub.dev/google/efficientnet/b7/classification/1" (input 600x600, very large)

IMAGE_SHAPE = (224, 224) # Expected by MobileNetV2
MAX_LABELS = 5          # Max number of labels to return per image
MIN_CONFIDENCE = 0.2    # Minimum confidence for a label to be considered

# --- Model Loading (Global for efficiency) ---
classifier_model = None
imagenet_labels = None

def load_model_and_labels():
    global classifier_model, imagenet_labels
    if classifier_model is None:
        print("Loading AI classification model...")
        try:
            # Wrap the KerasLayer with a try-except for better error messages on network issues
            classifier_model = hub.KerasLayer(MODEL_URL, input_shape=IMAGE_SHAPE+(3,))
            print("AI Model loaded successfully.")
        except Exception as e:
            print(f"Error loading KerasLayer from TF Hub: {e}")
            print("Please check your internet connection and the TF Hub URL.")
            # You might want to raise the exception or handle it more gracefully
            # For now, we'll let it be None, and classification will fail
            classifier_model = None # Ensure it's None if loading failed
            return

    if imagenet_labels is None and classifier_model is not None:
        print("Downloading ImageNet labels...")
        try:
            labels_path = tf.keras.utils.get_file(
                'ImageNetLabels.txt',
                'https://storage.googleapis.com/download.tensorflow.org/data/ImageNetLabels.txt'
            )
            with open(labels_path) as f:
                imagenet_labels = [line.strip() for line in f.readlines()]
            print("ImageNet labels loaded.")
        except Exception as e:
            print(f"Error downloading/loading ImageNet labels: {e}")
            imagenet_labels = None # Ensure it's None if loading failed

# --- Image Preprocessing ---
def preprocess_image(image_path: str) -> tf.Tensor:
    try:
        img = PILImage.open(image_path).convert('RGB')
        img = img.resize(IMAGE_SHAPE)
        img_array = np.array(img) / 255.0  # Normalize to [0,1]
        return tf.convert_to_tensor(img_array[np.newaxis, ...], dtype=tf.float32)
    except Exception as e:
        print(f"Error preprocessing image {image_path}: {e}")
        return None

# --- Prediction and Label Mapping ---
def classify_image(image_path: str) -> list[tuple[str, float]]:
    """
    Classifies an image and returns a list of (label, confidence) tuples.
    """
    global classifier_model, imagenet_labels
    
    if classifier_model is None or imagenet_labels is None:
        load_model_and_labels() # Attempt to load if not already loaded
        if classifier_model is None or imagenet_labels is None:
            print("AI Model or labels not available. Classification skipped.")
            return []

    processed_image = preprocess_image(image_path)
    if processed_image is None:
        return []

    try:
        predictions = classifier_model(processed_image, training=False) # verbose=0 to suppress Keras progress bar
        # The output of this MobileNetV2 model is a batch of logits, one for each class.
        # For models from TF Hub like this one, the output is often logits (raw scores).
        # We might need to apply softmax if the model doesn't do it internally.
        # However, for picking top K, argmax on logits often works similarly to softmax.
        # Let's assume for now predictions are probabilities or can be treated as such for ranking.
        # If results are poor, add: probabilities = tf.nn.softmax(predictions[0]).numpy()
        
        scores = predictions[0] # Get the scores for the single image in the batch

        # Get top K results
        top_k_indices = np.argsort(scores)[-MAX_LABELS:][::-1] # Get indices of top K scores
        
        results = []
        for i in top_k_indices:
            confidence = float(scores[i]) # Use the raw score as confidence
            # If using softmax: confidence = float(probabilities[i])

            if confidence >= MIN_CONFIDENCE:
                label = imagenet_labels[i]
                results.append((label, confidence))
        return results
    except Exception as e:
        print(f"Error during AI classification for {image_path}: {e}")
        return []

# --- Simplified Tag Mapping (Example - Customize this heavily!) ---
# This is a very basic example. You'll want a more sophisticated mapping.
# You might use keywords, categories, or even another model for this.
RELEVANT_TAG_KEYWORDS = {
    "animal": ["dog", "cat", "bird", "wildlife", "animal", "pet", "leopard", "lion", "tiger", "elephant", "zebra", "bear", "fox", "squirrel", "koala", "panda"],
    "person": ["person", "people", "portrait", "man", "woman", "child", "face", "crowd"],
    "food": ["food", "dish", "meal", "fruit", "vegetable", "restaurant", "plate", "pizza", "burger", "sushi", "cake", "coffee"],
    "nature": ["nature", "landscape", "mountain", "forest", "tree", "flower", "sky", "cloud", "waterfall", "lake", "river", "beach", "ocean", "sunset", "sunrise"],
    "cityscape": ["city", "building", "street", "urban", "skyline", "architecture", "bridge"],
    "vehicle": ["car", "truck", "bus", "motorcycle", "bicycle", "train", "airplane", "boat", "vehicle"],
    "night": ["night", "dark"],
    "document": ["text", "paper", "document", "book", "sign"],
    "sports": ["sport", "game", "ball", "player", "stadium", "running", "soccer", "basketball"],
    "beach": ["beach", "sand", "ocean", "sea", "coast"],
    "indoors": ["room", "interior", "furniture", "house", "office"],
    "art": ["art", "painting", "sculpture", "museum"],
}

def map_labels_to_tags(predicted_labels: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """
    Maps raw ImageNet labels to a more concise set of tags.
    Returns a list of (tag, confidence) tuples.
    This is a simple keyword-based approach.
    """
    final_tags_with_confidence = {} # Use a dict to store best confidence for each tag
    
    for label, confidence in predicted_labels:
        label_lower = label.lower()
        for tag_category, keywords in RELEVANT_TAG_KEYWORDS.items():
            for keyword in keywords:
                if keyword in label_lower:
                    # If tag_category already found, update if current confidence is higher
                    if tag_category not in final_tags_with_confidence or confidence > final_tags_with_confidence[tag_category]:
                        final_tags_with_confidence[tag_category] = confidence
                    break # Found a keyword for this category, move to next label
    
    # Convert dict to list of tuples, sorted by confidence
    sorted_tags = sorted(final_tags_with_confidence.items(), key=lambda item: item[1], reverse=True)
    return sorted_tags

# --- Main function to get tags for an image ---
def get_tags_for_image(image_path: str) -> list[tuple[str, float]]:
    """
    High-level function to get simplified tags for an image.
    Returns list of (tag_name, confidence_score)
    """
    if not os.path.exists(image_path):
        print(f"Image path does not exist: {image_path}")
        return []
    
    raw_predictions = classify_image(image_path)
    if not raw_predictions:
        return []
    
    simplified_tags = map_labels_to_tags(raw_predictions)
    return simplified_tags

# Call load_model_and_labels() when the module is imported to pre-load the model.
# This can take time, so be mindful of startup.
# Alternatively, call it on first use or in a background thread during app startup.
# For now, let's load it here.
# load_model_and_labels() # Comment out if you want to lazy load on first call to get_tags_for_image

if __name__ == '__main__':
    # Example Usage (for testing this script directly)
    load_model_and_labels() # Ensure model is loaded for testing
    if classifier_model is None or imagenet_labels is None:
        print("Exiting test: Model or labels could not be loaded.")
    else:
        # Create a dummy image for testing or point to a real image
        # test_image_path = "path/to/your/test_image.jpg"
        # if os.path.exists(test_image_path):
        #     tags = get_tags_for_image(test_image_path)
        #     print(f"Tags for {test_image_path}: {tags}")
        # else:
        #     print(f"Test image not found: {test_image_path}. Please provide a valid image path for testing.")
        print("AI module loaded. Provide an image path for testing if needed.")
        # Example:
        # python -m app.ai.image_classifier path/to/your/image.jpg (if run from backend dir)
        import sys
        if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
            test_image_path = sys.argv[1]
            print(f"Testing with image: {test_image_path}")
            tags = get_tags_for_image(test_image_path)
            print(f"Raw predictions: {classify_image(test_image_path)}")
            print(f"Mapped Tags: {tags}")
        else:
             print("Run with: python -m app.ai.image_classifier <path_to_image.jpg> for testing from backend folder")